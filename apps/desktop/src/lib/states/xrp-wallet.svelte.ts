import {
	electrobun,
	type XrpTxEntry,
	type XrpWalletInfo,
} from '$lib/electrobun'
import { tryCatch } from '@koins/utils'

export const xrpNetwork = {
	id: 'xrp',
	name: 'XRP Ledger',
	symbol: 'XRP',
	explorerUrl: 'https://xrpscan.com/tx/',
	explorerAddressUrl: 'https://xrpscan.com/account/',
} as const

export const XrpWallet = () => {
	let accountType = $state<'xrp' | null>(null)
	let ready = $state(false)
	let biometricAvailable = $state(false)
	let seed = $state('')
	let address = $state('')
	let balance = $state('0')
	let funded = $state(true)
	let price = $state<string | null>(null)
	let fee = $state<string | null>(null)
	let transactions = $state<XrpTxEntry[]>([])
	let loadingBalance = $state(false)
	let loadingTransactions = $state(false)
	let loading = $state(false)
	let error = $state('')
	let wallets = $state<XrpWalletInfo[]>([])
	let currentWalletId = $state<string | null>(null)
	let currentPasswordHash = $state<string | null>(null)

	async function hashPassword(
		password: string,
		salt?: string,
	): Promise<{ salt: string; hash: string }> {
		const s =
			salt ??
			Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
				b.toString(16).padStart(2, '0'),
			).join('')
		const enc = new TextEncoder()
		const key = await crypto.subtle.importKey(
			'raw',
			enc.encode(password + s),
			'PBKDF2',
			false,
			['deriveBits'],
		)
		const bits = await crypto.subtle.deriveBits(
			{
				name: 'PBKDF2',
				salt: enc.encode(s),
				iterations: 100_000,
				hash: 'SHA-256',
			},
			key,
			256,
		)
		const hash = Array.from(new Uint8Array(bits), (b) =>
			b.toString(16).padStart(2, '0'),
		).join('')
		return { salt: s, hash }
	}

	const checkBiometric = async () => {
		if (!electrobun.rpc) return
		const [ok] = await tryCatch(
			electrobun.rpc.request.biometricCanAuth({}),
		)
		biometricAvailable = ok === true
	}

	const init = async () => {
		if (!electrobun.rpc) return
		const [walletList] = await tryCatch(
			electrobun.rpc.request.xrpListWallets({}),
		)
		if (walletList) {
			wallets = walletList
			if (walletList.length > 0 && !currentWalletId) {
				currentWalletId = walletList[0].id
			}
		}
		await checkBiometric()
		ready = true
	}

	const login = async () => {
		accountType = 'xrp'
		if (seed) await refresh()
	}

	const logout = async () => {
		accountType = null
		clearWallet()
	}

	const clearWallet = () => {
		seed = ''
		address = ''
		balance = '0'
		funded = true
		transactions = []
		error = ''
		currentPasswordHash = null
	}

	const loadSeedForWallet = async (walletId: string) => {
		if (!electrobun.rpc) return false
		const wallet = wallets.find((w) => w.id === walletId)
		if (!wallet) return false
		const [vaultSeed] = await tryCatch(
			electrobun.rpc.request.xrpGetSeed({
				vaultKey: wallet.vaultKey,
			}),
		)
		if (!vaultSeed) return false
		seed = vaultSeed
		address = wallet.address
		await refresh()
		return true
	}

	const unlockWithBiometrics = async () => {
		if (!electrobun.rpc) return false
		const [authed] = await tryCatch(
			electrobun.rpc.request.biometricAuth({
				reason: 'Unlock wallet',
			}),
		)
		if (!authed) return false
		if (!currentWalletId) return false
		return loadSeedForWallet(currentWalletId)
	}

	const unlockWithPassword = async (password: string) => {
		if (!currentPasswordHash || !currentWalletId) return false
		try {
			const { salt, hash } = JSON.parse(currentPasswordHash)
			const { hash: check } = await hashPassword(password, salt)
			if (check !== hash) return false
			return loadSeedForWallet(currentWalletId)
		} catch {
			return false
		}
	}

	const selectWallet = async (walletId: string) => {
		currentWalletId = walletId
		clearWallet()
		const wallet = wallets.find((w) => w.id === walletId)
		if (!wallet) return
		if (wallet.hasPassword && electrobun.rpc) {
			const [ph] = await tryCatch(
				electrobun.rpc.request.getSecret({
					service: 'koins',
					name: `xrp_auth_${walletId}`,
				}),
			)
			if (ph) {
				currentPasswordHash = ph
			}
		} else {
			currentPasswordHash = null
		}
	}

	const selectAndUnlockWallet = async (walletId: string) => {
		await selectWallet(walletId)
		if (!currentPasswordHash && biometricAvailable) {
			return unlockWithBiometrics()
		}
		if (!currentPasswordHash) {
			return loadSeedForWallet(walletId)
		}
		return false
	}

	const autoUnlock = async (walletId?: string) => {
		const id = walletId ?? currentWalletId ?? wallets[0]?.id
		if (!id) return false
		currentWalletId = id
		const wallet = wallets.find((w) => w.id === id)
		if (!wallet) return false
		if (electrobun.rpc && wallet.hasPassword) {
			const [ph] = await tryCatch(
				electrobun.rpc.request.getSecret({
					service: 'koins',
					name: `xrp_auth_${id}`,
				}),
			)
			if (ph) currentPasswordHash = ph
		} else {
			currentPasswordHash = null
		}
		const ok = await loadSeedForWallet(id)
		if (ok) accountType = 'xrp'
		return ok
	}

	const saveWallet = async (
		kind: 'create' | 'import',
		name: string,
		secret: string | undefined,
		password?: string,
	) => {
		loading = true
		error = ''
		try {
			if (!electrobun.rpc) throw new Error('RPC not available')
			let passwordHash: string | undefined
			if (password) {
				const ph = await hashPassword(password)
				passwordHash = JSON.stringify(ph)
			}
			const result: {
				id: string
				address: string
				createdAt: string
				seed?: string
			} =
				kind === 'create'
					? await electrobun.rpc.request.xrpCreateWallet({
							name,
							hasPassword: !!passwordHash,
						})
					: await electrobun.rpc.request.xrpImportWallet({
							name,
							secret: secret!,
							hasPassword: !!passwordHash,
						})

			if (passwordHash) {
				await electrobun.rpc.request.setSecret({
					service: 'koins',
					name: `xrp_auth_${result.id}`,
					value: passwordHash,
				})
			}

			const newWallet: XrpWalletInfo = {
				id: result.id,
				name,
				address: result.address,
				hasPassword: !!passwordHash,
				vaultKey: `xrp_seed_${result.id}`,
				createdAt: result.createdAt,
			}
			wallets = [...wallets, newWallet]
			currentWalletId = result.id
			if (passwordHash) currentPasswordHash = passwordHash
			seed = result.seed ?? secret!
			address = result.address
			await refresh()
			return result.seed
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save wallet'
			throw e
		} finally {
			loading = false
		}
	}

	const createWallet = async (name: string, password?: string) => {
		return saveWallet('create', name, undefined, password)
	}

	const importWallet = async (
		name: string,
		secret: string,
		password?: string,
	) => {
		return saveWallet('import', name, secret, password)
	}

	const deleteWallet = async (walletId: string) => {
		await electrobun.rpc?.request.xrpDeleteWallet({ id: walletId })
		wallets = wallets.filter((w) => w.id !== walletId)
		if (currentWalletId === walletId) {
			clearWallet()
			currentWalletId = wallets.length > 0 ? wallets[0].id : null
		}
	}

	const clearSelection = () => {
		clearWallet()
		currentWalletId = null
	}

	const refresh = async () => {
		if (!address || !electrobun.rpc) return
		const rpc = electrobun.rpc
		loadingBalance = true
		loadingTransactions = true
		error = ''
		;(async () => {
			const [bal] = await tryCatch(
				rpc.request.xrpGetBalance({ address }),
			)
			if (bal) {
				balance = bal.balance
				funded = bal.funded
			}
			const [p] = await tryCatch(rpc.request.fetchXrpPrice({}))
			if (p) price = p.usd
			const [f] = await tryCatch(rpc.request.xrpGetFee({}))
			if (f) fee = f.fee
			loadingBalance = false
		})()
		;(async () => {
			const [txs] = await tryCatch(
				rpc.request.xrpGetTransactions({ address }),
			)
			if (txs) transactions = txs
			loadingTransactions = false
		})()
	}

	const send = async (
		to: string,
		amount: string,
		destinationTag?: number,
	) => {
		if (!electrobun.rpc || !seed) throw new Error('Wallet not unlocked')
		const result = await electrobun.rpc.request.xrpSend({
			secret: seed,
			to,
			amount,
			destinationTag,
		})
		await refresh()
		return result
	}

	const lock = () => {
		clearWallet()
	}

	const reset = () => {
		clearWallet()
		wallets = []
		currentWalletId = null
	}

	const resetApp = async () => {
		if (!electrobun.rpc) return false
		const [ok] = await tryCatch(electrobun.rpc.request.resetApp({}))
		if (!ok) return false
		reset()
		return true
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
		get seed() {
			return seed
		},
		get address() {
			return address
		},
		get balance() {
			return balance
		},
		get funded() {
			return funded
		},
		get price() {
			return price
		},
		get fee() {
			return fee
		},
		get transactions() {
			return transactions
		},
		get loading() {
			return loading || loadingBalance || loadingTransactions
		},
		get loadingBalance() {
			return loadingBalance
		},
		get loadingTransactions() {
			return loadingTransactions
		},
		get error() {
			return error
		},
		get wallets() {
			return wallets
		},
		get currentWalletId() {
			return currentWalletId
		},
		get currentWallet() {
			return wallets.find((w) => w.id === currentWalletId) ?? null
		},
		get isLocked() {
			return !!currentWalletId && !seed
		},
		get hasWallets() {
			return wallets.length > 0
		},
		get currentPasswordHash() {
			return currentPasswordHash
		},
		get explorerAddressUrl() {
			return address ? `${xrpNetwork.explorerAddressUrl}${address}` : ''
		},
		set error(v: string) {
			error = v
		},
		init,
		login,
		logout,
		refresh,
		createWallet,
		importWallet,
		lock,
		reset,
		resetApp,
		unlockWithBiometrics,
		unlockWithPassword,
		hashPassword,
		selectWallet,
		selectAndUnlockWallet,
		autoUnlock,
		loadSeedForWallet,
		deleteWallet,
		clearSelection,
		send,
	}
}

export const xrpWallet = XrpWallet()
