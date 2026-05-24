	import { electrobun, type MoneroTxEntry, type MoneroAccountEntry, type MoneroSendResult } from '$lib/electrobun'
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
	const whole = n / 10_000_000_000_000n
	const frac = (n % 10_000_000_000_000n).toString().padStart(12, '0').replace(/0+$/, '')
	return frac ? `${whole}.${frac}` : `${whole}`
}

export type AccountType = 'multi' | 'monero'

export const MoneroWallet = () => {
	let accountType = $state<AccountType | null>(null)
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
			electrobun.rpc.request.biometricAuth({ reason: 'Unlock wallet' }),
		)
		return authed === true
	}

	const init = async () => {
		await checkStatus()
		if (installed && !running && !downloading) {
			await start()
			await checkStatus()
		}
		await checkBiometric()
		ready = true
	}

	const login = async () => {
		accountType = 'monero'
		if (installed && !running) {
			await start()
			await checkStatus()
		}
		await listWallets()
	}

	const logout = async () => {
		await stop()
		accountType = null
	}

	const moneroGetStoredPassword = async (name: string): Promise<string | null> => {
		if (!electrobun.rpc) return null
		const [raw] = await tryCatch(
			electrobun.rpc.request.getSecret({ service: 'koins', name: `monero_pw_${name}` }),
		)
		return raw ?? null
	}

	const moneroStorePassword = async (name: string, password: string) => {
		if (!electrobun.rpc) return
		await electrobun.rpc.request.setSecret({ service: 'koins', name: `monero_pw_${name}`, value: password })
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

	const openExistingWallet = async (name: string, password?: string) => {
		if (!electrobun.rpc) throw new Error('RPC not available')
		const pw = password ?? await moneroGetStoredPassword(name)
		if (!pw) throw new Error('Password required')
		await electrobun.rpc.request.moneroOpenWallet({ name, password: pw })
		walletName = name
		walletOpen = true
		await refresh()
	}

	const checkStatus = async () => {
		if (!electrobun.rpc) return
		const [binStatus] = await tryCatch(
			electrobun.rpc.request.moneroBinaryStatus({}),
		)
		if (binStatus) {
			installed = binStatus.installed
			downloading = binStatus.downloading
		}
		const [status] = await tryCatch(
			electrobun.rpc.request.moneroWalletStatus({}),
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
		const status = await electrobun.rpc.request.moneroStart({})
		running = status.running
		connected = status.connected
	}

	const stop = async () => {
		if (!electrobun.rpc) return
		await electrobun.rpc.request.moneroStop({})
		running = false
		walletOpen = false
		connected = false
		address = ''
		balAtomic = '0'
		unlockedAtomic = '0'
		txs = []
		accounts = []
		wallets = []
	}

	const createWallet = async (name: string, password: string, storePw?: boolean) => {
		if (!electrobun.rpc) throw new Error('RPC not available')
		const result = await electrobun.rpc.request.moneroCreateWallet({ name, password })
		walletName = name
		walletOpen = true
		address = result.address
		if (storePw) await moneroStorePassword(name, password)
		await refresh()
		return result
	}

	const restoreWallet = async (name: string, password: string, mnemonic: string, restoreHeight?: number, storePw?: boolean) => {
		if (!electrobun.rpc) throw new Error('RPC not available')
		const result = await electrobun.rpc.request.moneroRestoreWallet({
			name, password, mnemonic, restoreHeight,
		})
		walletName = name
		walletOpen = true
		address = result.address
		if (storePw) await moneroStorePassword(name, password)
		await refresh()
	}

	const openWallet = async (name: string, password: string) => {
		if (!electrobun.rpc) return
		await electrobun.rpc.request.moneroOpenWallet({ name, password })
		walletName = name
		walletOpen = true
		await refresh()
	}

	const refresh = async () => {
		if (!electrobun.rpc) return
		loading = true
		try {
			const [bal] = await tryCatch(
				electrobun.rpc.request.moneroGetBalance({}),
			)
			if (bal) {
				balAtomic = bal.balance
				unlockedAtomic = bal.unlocked
				address = bal.address
				height = bal.height
				daemonHeight = bal.daemonHeight
			}
			const [result] = await tryCatch(
				electrobun.rpc.request.moneroGetTransactions({}),
			)
			txs = result ?? []
			await fetchAccounts()
		} catch (e) {
			error = e instanceof Error ? e.message : 'Monero refresh failed'
		} finally {
			loading = false
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

	return {
		get accountType() { return accountType },
		get ready() { return ready },
		get biometricAvailable() { return biometricAvailable },
		get running() { return running },
		get walletOpen() { return walletOpen },
		get connected() { return connected },
		get balAtomic() { return balAtomic },
		get unlockedAtomic() { return unlockedAtomic },
		get address() { return address },
		get height() { return height },
		get daemonHeight() { return daemonHeight },
		get txs() { return txs },
		get installed() { return installed },
		get downloading() { return downloading },
		get walletName() { return walletName },
		get accounts() { return accounts },
		get wallets() { return wallets },
		get loading() { return loading },
		get error() { return error },
		get balance() { return atomicToXmr(balAtomic) },
		get unlocked() { return atomicToXmr(unlockedAtomic) },
		set error(v: string) { error = v },
		set installed(v: boolean) { installed = v },
		set downloading(v: boolean) { downloading = v },
		set running(v: boolean) { running = v },
		set connected(v: boolean) { connected = v },
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
		refresh,
		send,
	}
}

export const moneroWallet = MoneroWallet()
