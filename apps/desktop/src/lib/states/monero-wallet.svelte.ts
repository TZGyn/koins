import {
	electrobun,
	frontendLog,
	frontendLogError,
	type MoneroTxEntry,
	type MoneroAccountEntry,
	type MoneroSendResult,
} from '$lib/electrobun'
import { tryCatch } from '@koins/utils'

export const moneroNetwork = {
	id: 'monero',
	name: 'Monero',
	rpc: '',
	symbol: 'XMR',
	chainid: '',
	explorerUrl: 'https://moneroblocks.info/tx/',
} as const

export const atomicToXmr = (atomic: string): string => {
	const n = BigInt(atomic)
	const whole = n / 1_000_000_000_000n
	const frac = (n % 1_000_000_000_000n)
		.toString()
		.padStart(12, '0')
		.replace(/0+$/, '')
	return frac ? `${whole}.${frac}` : `${whole}`
}

export const createMoneroWallet = () => {
	let accountType = $state<'monero' | null>(null)
	let ready = $state(false)
	let biometricAvailable = $state(false)
	let running = $state(false)
	let walletOpen = $state(false)
	let connected = $state(false)
	let balAtomic = $state('0')
	let unlockedAtomic = $state('0')
	let address = $state('')
	let height = $state(0)
	let daemonHeight = $state(0)
	let txs = $state<MoneroTxEntry[]>([])
	let installed = $state(false)
	let downloading = $state(false)
	let walletName = $state('')
	let accounts = $state<MoneroAccountEntry[]>([])
	let wallets = $state<string[]>([])
	let loading = $state(false)
	let error = $state('')
	let selectedAccountIndex = $state(0)
	let opening = $state(false)
	let openingDepth = 0
	let passwordRequired = $state(false)
	let startInFlight: Promise<{ running: boolean; connected: boolean }> | null = null
	let loginInFlight: Promise<void> | null = null
	let refreshInFlight: Promise<void> | null = null
	let syncing = $state(false)
	let syncRetryTimer: ReturnType<typeof setTimeout> | null = null
	let price = $state<string | null>(null)
	let priceInFlight = false

	const rpcTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
		new Promise<T>((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new Error(`${label} timed out after ${ms}ms`)),
				ms,
			)
			promise.then(
				(v) => {
					clearTimeout(timer)
					resolve(v)
				},
				(e) => {
					clearTimeout(timer)
					reject(e)
				},
			)
		})

	const beginOpening = () => {
		openingDepth += 1
		opening = true
	}

	const endOpening = () => {
		openingDepth = Math.max(0, openingDepth - 1)
		if (openingDepth === 0) opening = false
	}

	const checkBiometric = async () => {
		if (!electrobun.rpc) return
		const [ok] = await tryCatch(
			electrobun.rpc.request.biometricCanAuth({}),
		)
		biometricAvailable = ok === true
	}

	const biometricAuth = async (): Promise<boolean> => {
		if (!electrobun.rpc) return false
		const [authed] = await tryCatch(
			electrobun.rpc.request.biometricAuth({
				reason: 'Unlock wallet',
			}),
		)
		return authed === true
	}

	let initPromise: Promise<void> | null = null
	const init = async () => {
		if (initPromise) return initPromise
		initPromise = (async () => {
			await checkStatus()
			if (installed && !running && !downloading) {
				await start()
				await checkStatus()
			}
			await checkBiometric()
			ready = true
		})()
		return initPromise
	}

	const login = async () => {
		if (walletOpen) return
		if (loginInFlight) return loginInFlight
		loginInFlight = (async () => {
			accountType = 'monero'
			error = ''
			beginOpening()
			try {
				if (installed && !running) {
					await start()
					await checkStatus()
				} else if (startInFlight) {
					// a start is already in flight (e.g. triggered by init);
					// wait for it so we don't call open before the server is up
					await startInFlight.catch(() => {})
					await checkStatus()
				}
				if (!running) {
					error = 'Wallet server failed to start. Please try again.'
					return
				}
				await listWallets()
				if (wallets.length > 0) {
					const pw = await moneroGetStoredPassword(wallets[0])
					if (pw) await openExistingWallet(wallets[0], pw)
					else passwordRequired = true
				}
				error = ''
			} catch (e) {
				error = e instanceof Error ? e.message : 'Failed to open wallet'
			} finally {
				endOpening()
			}
		})()
		try {
			await loginInFlight
		} finally {
			loginInFlight = null
		}
	}

	const logout = async () => {
		await stop()
		accountType = null
	}

	const moneroGetStoredPassword = async (
		name: string,
	): Promise<string | null> => {
		if (!electrobun.rpc) return null
		const [raw] = await tryCatch(
			electrobun.rpc.request.getSecret({
				service: 'koins',
				name: `monero_pw_${name}`,
			}),
		)
		return raw ?? null
	}

	const moneroStorePassword = async (
		name: string,
		password: string,
	) => {
		if (!electrobun.rpc) return
		await electrobun.rpc.request.setSecret({
			service: 'koins',
			name: `monero_pw_${name}`,
			value: password,
		})
	}

	const fetchAccounts = async () => {
		if (!electrobun.rpc) return false
		const [result, err] = await tryCatch(
			electrobun.rpc.request.moneroGetAccounts({}),
		)
		if (err) return false
		accounts = result ?? []
		return true
	}

	const listWallets = async () => {
		if (!electrobun.rpc) return
		const [result] = await tryCatch(
			electrobun.rpc.request.moneroListWallets({}),
		)
		wallets = result ?? []
	}

	const openExistingWallet = async (
		name: string,
		password?: string,
	) => {
		if (!electrobun.rpc) throw new Error('RPC not available')
		const pw = password ?? (await moneroGetStoredPassword(name))
		if (!pw) throw new Error('Password required')
		beginOpening()
		try {
			await electrobun.rpc.request.moneroOpenWallet({
				name,
				password: pw,
			})
			walletName = name
			walletOpen = true
			await refresh()
		} finally {
			endOpening()
		}
	}

	const checkStatus = async () => {
		if (!electrobun.rpc) return
		const [binStatus] = await tryCatch(
			rpcTimeout(
				electrobun.rpc.request.moneroBinaryStatus({}),
				15000,
				'moneroBinaryStatus',
			),
		)
		if (binStatus) {
			installed = binStatus.installed
			downloading = binStatus.downloading
		}
		const [status] = await tryCatch(
			rpcTimeout(
				electrobun.rpc.request.moneroWalletStatus({}),
				30000,
				'moneroWalletStatus',
			),
		)
		if (status) {
			running = status.running
			walletOpen = status.walletOpen
			connected = status.connected
		}
	}

	const download = async () => {
		if (!electrobun.rpc) return
		downloading = true
		try {
			await electrobun.rpc.request.moneroDownloadBinary({})
			installed = true
		} finally {
			downloading = false
		}
	}

	const start = async () => {
		if (!electrobun.rpc) return
		beginOpening()
		try {
			if (!startInFlight) {
				startInFlight = electrobun.rpc.request.moneroStart({})
				const status = await startInFlight
				running = status.running
				connected = status.connected
			} else {
				await startInFlight
			}
		} finally {
			startInFlight = null
			endOpening()
		}
	}

	const stop = async () => {
		if (!electrobun.rpc) return
		await electrobun.rpc.request.moneroStop({})
		running = false
		walletOpen = false
		connected = false
		passwordRequired = false
		address = ''
		balAtomic = '0'
		unlockedAtomic = '0'
		txs = []
		accounts = []
		wallets = []
	}

	const createWallet = async (
		name: string,
		password: string,
		storePw?: boolean,
	) => {
		if (!electrobun.rpc) throw new Error('RPC not available')
		beginOpening()
		try {
			const result = await electrobun.rpc.request.moneroCreateWallet({
				name,
				password,
			})
			walletName = name
			walletOpen = true
			address = result.address
			if (storePw) await moneroStorePassword(name, password)
			await refresh()
			return result
		} finally {
			endOpening()
		}
	}

	const restoreWallet = async (
		name: string,
		password: string,
		mnemonic: string,
		restoreHeight?: number,
		storePw?: boolean,
	) => {
		if (!electrobun.rpc) throw new Error('RPC not available')
		beginOpening()
		try {
			const result = await electrobun.rpc.request.moneroRestoreWallet({
				name,
				password,
				mnemonic,
				restoreHeight,
			})
			walletName = name
			walletOpen = true
			address = result.address
			if (storePw) await moneroStorePassword(name, password)
			await refresh()
		} finally {
			endOpening()
		}
	}

	const openWallet = async (name: string, password: string) => {
		if (!electrobun.rpc) return
		beginOpening()
		try {
			await electrobun.rpc.request.moneroOpenWallet({ name, password })
			walletName = name
			walletOpen = true
			await refresh()
		} finally {
			endOpening()
		}
	}

	const autoUnlock = async (name?: string) => {
		if (!electrobun.rpc) return false
		const target = name ?? wallets[0]
		if (!target) return false
		const pw = await moneroGetStoredPassword(target)
		if (!pw) {
			passwordRequired = true
			return false
		}
		beginOpening()
		try {
			await electrobun.rpc.request.moneroOpenWallet({
				name: target,
				password: pw,
			})
			walletName = target
			walletOpen = true
			passwordRequired = false
			error = ''
			await refresh()
			return true
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to open wallet'
			return false
		} finally {
			endOpening()
		}
	}

	const unlockWallet = async (password: string, remember = false) => {
		const target = wallets[0]
		if (!target) return
		await openWallet(target, password)
		passwordRequired = false
		if (remember) await moneroStorePassword(target, password)
	}

	const scheduleSyncRetry = () => {
		if (syncRetryTimer) clearTimeout(syncRetryTimer)
		syncRetryTimer = setTimeout(async () => {
			syncRetryTimer = null
			if (walletOpen && !loading) await refresh()
		}, 15000)
	}

	const refresh = async () => {
		const rpc = electrobun.rpc
		if (!rpc) return
		if (refreshInFlight) return refreshInFlight
		refreshInFlight = (async () => {
			loading = true
			let failed = false
			const wasSyncing = syncing
			let lastError: unknown = null
			try {
				const [bal, balErr] = await tryCatch(
					rpcTimeout(
						rpc.request.moneroGetBalance({}),
						20000,
						'moneroGetBalance',
					),
				)
				if (balErr) {
					failed = true
					lastError = balErr
				}
				if (bal) {
					balAtomic = bal.balance
					unlockedAtomic = bal.unlocked
					address = bal.address
					height = bal.height
					daemonHeight = bal.daemonHeight
				}
				const [result, txErr] = await tryCatch(
					rpcTimeout(
						rpc.request.moneroGetTransactions({
							accountIndex: selectedAccountIndex,
						}),
						20000,
						'moneroGetTransactions',
					),
				)
				if (txErr) {
					failed = true
					lastError = txErr
				}
				txs = result ?? []
				const ok = await fetchAccounts()
				if (!ok) {
					failed = true
					lastError = new Error('moneroGetAccounts failed')
				}
				if (failed) {
					// The wallet-rpc is likely busy syncing; keep the stale
					// balance and retry shortly instead of showing an error.
					syncing = true
					scheduleSyncRetry()
					frontendLogError(
						`monero refresh failed (height ${height}/${daemonHeight})`,
						lastError,
					)
				} else {
					if (wasSyncing) {
						frontendLog(`monero sync complete at height ${height}`)
					}
					syncing = false
				}
			} catch (e) {
				syncing = true
				scheduleSyncRetry()
				frontendLogError(
					`monero refresh failed (height ${height}/${daemonHeight})`,
					e,
				)
			} finally {
				loading = false
				refreshInFlight = null
			}
		})()
		return refreshInFlight
	}

	const fetchPrice = async () => {
		const rpc = electrobun.rpc
		if (!rpc || priceInFlight) return
		priceInFlight = true
		try {
			const [p] = await tryCatch(rpc.request.fetchMoneroPrice({}))
			if (p) price = p.usd
		} finally {
			priceInFlight = false
		}
	}

	const send = async (
		address: string,
		amountAtomic: string,
		priority?: number,
		accountIndex?: number,
	): Promise<MoneroSendResult> => {
		if (!electrobun.rpc) throw new Error('RPC not available')
		const result = await electrobun.rpc.request.moneroTransfer({
			address,
			amount: amountAtomic,
			priority,
			accountIndex,
		})
		await refresh()
		return result
	}

	const sendAll = async (
		address: string,
		priority?: number,
		accountIndex?: number,
	): Promise<MoneroSendResult> => {
		if (!electrobun.rpc) throw new Error('RPC not available')
		const result = await electrobun.rpc.request.moneroSweepAll({
			address,
			priority,
			accountIndex,
		})
		await refresh()
		return result
	}

	const createAccount = async (label?: string) => {
		if (!electrobun.rpc) throw new Error('RPC not available')
		const result = await electrobun.rpc.request.moneroCreateAccount({
			label,
		})
		await refresh()
		return result
	}

	const createSubaddress = async (
		accountIndex: number,
		label?: string,
	) => {
		if (!electrobun.rpc) throw new Error('RPC not available')
		const result =
			await electrobun.rpc.request.moneroCreateSubaddress({
				accountIndex,
				label,
			})
		await refresh()
		return result
	}

	return {
		get accountType() {
			return accountType
		},
		get ready() {
			return ready
		},
		get biometricAvailable() {
			return biometricAvailable
		},
		get running() {
			return running
		},
		get walletOpen() {
			return walletOpen
		},
		get connected() {
			return connected
		},
		get balAtomic() {
			return balAtomic
		},
		get unlockedAtomic() {
			return unlockedAtomic
		},
		get address() {
			return address
		},
		get height() {
			return height
		},
		get daemonHeight() {
			return daemonHeight
		},
		get txs() {
			return txs
		},
		get installed() {
			return installed
		},
		get downloading() {
			return downloading
		},
		get walletName() {
			return walletName
		},
		get accounts() {
			return accounts
		},
		get wallets() {
			return wallets
		},
		get loading() {
			return loading
		},
		get opening() {
			return opening
		},
		get passwordRequired() {
			return passwordRequired
		},
		get syncing() {
			return syncing
		},
		get price() {
			return price
		},
		get error() {
			return error
		},
		get balance() {
			return atomicToXmr(balAtomic)
		},
		get unlocked() {
			return atomicToXmr(unlockedAtomic)
		},
		set error(v: string) {
			error = v
		},
		set installed(v: boolean) {
			installed = v
		},
		set downloading(v: boolean) {
			downloading = v
		},
		set running(v: boolean) {
			running = v
		},
		set connected(v: boolean) {
			connected = v
		},
		get selectedAccountIndex() {
			return selectedAccountIndex
		},
		set selectedAccountIndex(v: number) {
			selectedAccountIndex = v
		},
		init,
		login,
		logout,
		biometricAuth,
		moneroGetStoredPassword,
		moneroStorePassword,
		fetchAccounts,
		listWallets,
		openExistingWallet,
		checkStatus,
		download,
		start,
		stop,
		createWallet,
		restoreWallet,
		openWallet,
		autoUnlock,
		unlockWallet,
		refresh,
		fetchPrice,
		send,
		sendAll,
		createAccount,
		createSubaddress,
	}
}

// Singleton: calling MoneroWallet() always returns the same instance, so
// no component can ever create a second, disconnected wallet state.
type MoneroWalletStore = ReturnType<typeof createMoneroWallet>

let moneroWalletInstance: MoneroWalletStore | null = null

export const MoneroWallet = (): MoneroWalletStore => {
	if (!moneroWalletInstance) moneroWalletInstance = createMoneroWallet()
	return moneroWalletInstance
}

export const moneroWallet = MoneroWallet()
