import { mnemonicToAccount } from 'viem/accounts'
import { createPublicClient, http, formatEther } from 'viem'
import {
	electrobun,
	type TxEntry,
	type EvmWalletInfo,
} from '$lib/electrobun'
import { tryCatch } from '@koins/utils'
import { moneroWallet } from './monero-wallet.svelte.js'

export const networks = [
	{
		id: 'bsc',
		name: 'BNB Smart Chain',
		rpc: 'https://bsc-dataseed.binance.org',
		symbol: 'BNB',
		chainid: '56',
		explorerUrl: 'https://bscscan.com/tx/',
	},
	{
		id: 'polygon',
		name: 'Polygon',
		rpc: 'https://polygon-bor.publicnode.com',
		symbol: 'POL',
		chainid: '137',
		explorerUrl: 'https://polygonscan.com/tx/',
	},
	{
		id: 'eth',
		name: 'Ethereum',
		rpc: 'https://ethereum-rpc.publicnode.com',
		symbol: 'ETH',
		chainid: '1',
		explorerUrl: 'https://etherscan.io/tx/',
	},
] as const

export type NetworkId = (typeof networks)[number]['id']

export type TokenBalance = {
	symbol: string
	balance: string
	contractAddress: string
	logo?: string
}

export type AccountType = 'multi' | 'monero'

export const EvmWallet = () => {
	let accountType = $state<AccountType | null>(null)
	let ready = $state(false)
	let biometricAvailable = $state(false)
	let seed = $state('')
	let address = $state('')
	let balance = $state('0')
	let tokenBalances = $state<TokenBalance[]>([])
	let network = $state<NetworkId>('eth')
	let apiKey = $state('')
	let transactions = $state<TxEntry[]>([])
	let loadingBalance = $state(false)
	let loadingTransactions = $state(false)
	let loading = $state(false)
	let error = $state('')
	let wallets = $state<EvmWalletInfo[]>([])
	let currentWalletId = $state<string | null>(null)
	let currentPasswordHash = $state<string | null>(null)

	const net = () => networks.find((n) => n.id === network)!

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

		electrobun.rpc.addMessageListener(
			'transfersUpdate',
			(payload: {
				chainid: string
				address: string
				count: number
			}) => {
				if (
					payload.address === address &&
					payload.chainid === net().chainid
				) {
					fetchTxHistory()
				}
			},
		)

		const [walletList] = await tryCatch(
			electrobun.rpc.request.evmListWallets({}),
		)
		if (walletList) {
			wallets = walletList
			if (walletList.length === 1 && !currentWalletId) {
				currentWalletId = walletList[0].id
			}
		}

		const [key] = await tryCatch(
			electrobun.rpc.request.getSecret({
				service: 'koins',
				name: 'alchemy_key',
			}),
		)
		if (key) apiKey = key

		// await moneroWallet.checkStatus()
		// if (moneroWallet.installed && !moneroWallet.running && !moneroWallet.downloading) {
		// 	await moneroWallet.start()
		// 	await moneroWallet.checkStatus()
		// }

		await checkBiometric()
		ready = true
	}

	const login = async () => {
		accountType = 'multi'
		if (seed) await switchNetwork(network)
	}

	const logout = async () => {
		accountType = null
		clearWallet()
	}

	const clearWallet = () => {
		seed = ''
		address = ''
		balance = '0'
		tokenBalances = []
		transactions = []
		error = ''
		currentPasswordHash = null
		electrobun.rpc?.request.setAutoSync(null)
	}

	const unlockWallet = async (walletId: string) => {
		if (!electrobun.rpc) return false
		const wallet = wallets.find((w) => w.id === walletId)
		if (!wallet) return false
		currentWalletId = walletId
		const [vaultSeed] = await tryCatch(
			electrobun.rpc.request.evmGetSeed({
				vaultKey: wallet.vaultKey,
			}),
		)
		if (!vaultSeed) return false
		seed = vaultSeed
		await refresh()
		await setAutoSync()
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
		await loadSeedForWallet(currentWalletId)
		return !!seed
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

	const loadSeedForWallet = async (walletId: string) => {
		if (!electrobun.rpc) return false
		const wallet = wallets.find((w) => w.id === walletId)
		if (!wallet) return false
		const [vaultSeed] = await tryCatch(
			electrobun.rpc.request.evmGetSeed({
				vaultKey: wallet.vaultKey,
			}),
		)
		if (!vaultSeed) return false
		seed = vaultSeed
		await refresh()
		await setAutoSync()
		return true
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
					name: `evm_auth_${walletId}`,
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
		return false
	}

	const createWallet = async (
		name: string,
		phrase: string,
		password?: string,
	) => {
		loading = true
		error = ''
		try {
			mnemonicToAccount(phrase.trim())
			let passwordHash: string | undefined
			if (password) {
				const ph = await hashPassword(password)
				passwordHash = JSON.stringify(ph)
			}
			const [result, resultError] = await tryCatch(
				electrobun.rpc!.request.evmCreateWallet({
					name,
					phrase: phrase.trim(),
					passwordHash,
				}),
			)
			if (resultError) throw resultError

			if (passwordHash) {
				await electrobun.rpc?.request.setSecret({
					service: 'koins',
					name: `evm_auth_${result.id}`,
					value: passwordHash,
				})
			}

			const newWallet: EvmWalletInfo = {
				id: result.id,
				name,
				hasPassword: !!passwordHash,
				vaultKey: `evm_seed_${result.id}`,
				createdAt: result.createdAt,
			}
			wallets = [...wallets, newWallet]
			currentWalletId = result.id
			if (passwordHash) currentPasswordHash = passwordHash
			seed = phrase.trim()
			await refresh()
		} catch (e) {
			error = e instanceof Error ? e.message : 'Invalid seed phrase'
		} finally {
			loading = false
		}
	}

	const deleteWallet = async (walletId: string) => {
		await electrobun.rpc?.request.evmDeleteWallet({ id: walletId })
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

	const switchNetwork = async (id: NetworkId) => {
		network = id
		if (seed) await refresh()
	}

	const refresh = async () => {
		if (!seed || !electrobun.rpc) return
		loadingBalance = true
		loadingTransactions = true
		balance = '0'
		error = ''
		const account = mnemonicToAccount(seed)
		address = account.address
		const client = createPublicClient({ transport: http(net().rpc) })

		syncTxHistory()
		;(async () => {
			const [nativeBal] = await tryCatch(
				client.getBalance({ address: account.address }),
			)
			if (nativeBal !== undefined) balance = formatEther(nativeBal)
			const [bals] = await tryCatch(
				electrobun.rpc.request.fetchTokenBalances({
					address,
					chainid: net().chainid,
				}),
			)
			if (bals) tokenBalances = bals
			loadingBalance = false
		})()
		;(async () => {
			await fetchTxHistory()
			loadingTransactions = false
		})()
	}

	const syncTxHistory = () => {
		if (!address || !apiKey || !electrobun.rpc) return
		electrobun.rpc.request.syncTxHistory({
			address,
			chainid: net().chainid,
		})
	}

	const setAutoSync = async () => {
		if (!address || !electrobun.rpc) return
		electrobun.rpc.request.setAutoSync({
			address,
			chainid: net().chainid,
		})
	}

	const flushTxCache = async () => {
		await electrobun.rpc?.request.flushTxCache({})
		await fetchTxHistory()
	}

	const saveApiKey = async (key: string) => {
		await electrobun.rpc?.request.setSecret({
			service: 'koins',
			name: 'alchemy_key',
			value: key,
		})
		apiKey = key
		syncTxHistory()
		if (address) await fetchTxHistory()
	}

	const fetchTxHistory = async () => {
		if (!address) {
			transactions = []
			return
		}
		const txs = await electrobun.rpc?.request.fetchCachedTxHistory({
			address,
			chainid: net().chainid,
		})
		transactions = txs ?? []
	}

	const lock = () => {
		clearWallet()
	}

	const reset = () => {
		clearWallet()
		apiKey = ''
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
		get tokenBalances() {
			return tokenBalances
		},
		get network() {
			return network
		},
		get chainid() {
			return net().chainid
		},
		get networkName() {
			return net().name
		},
		get symbol() {
			return net().symbol
		},
		get explorerUrl() {
			return net().explorerUrl
		},
		get explorerAddressUrl() {
			return address
				? `${net().explorerUrl.replace('/tx/', '/address/')}${address}`
				: ''
		},
		get networks() {
			return networks
		},
		get apiKey() {
			return apiKey
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
		set apiKey(v: string) {
			apiKey = v
		},
		set error(v: string) {
			error = v
		},
		init,
		login,
		logout,
		refresh,
		createWallet,
		switchNetwork,
		saveApiKey,
		fetchTxHistory,
		lock,
		reset,
		resetApp,
		unlockWithBiometrics,
		unlockWithPassword,
		hashPassword,
		selectWallet,
		selectAndUnlockWallet,
		unlockWallet,
		deleteWallet,
		clearSelection,
		syncTxHistory,
		setAutoSync,
		flushTxCache,
	}
}

export const evmWallet = EvmWallet()
