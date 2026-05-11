import {
	JsonRpcProvider,
	HDNodeWallet,
	formatEther,
} from 'ethers'
import { electrobun, type TxEntry } from '$lib/electrobun'

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

export const Wallet = () => {
	let seed = $state('')
	let address = $state('')
	let balance = $state('0')
	let tokenBalances = $state<TokenBalance[]>([])
	let network = $state<NetworkId>('bsc')
	let loading = $state(false)
	let error = $state('')
	let vaultExists = $state(false)
	let ready = $state(false)
	let apiKey = $state('')
	let transactions = $state<TxEntry[]>([])

	const net = () => networks.find((n) => n.id === network)!

	const init = async () => {
		try {
			const raw = await electrobun.rpc?.request.getSecret({
				service: 'koins',
				name: 'vault',
			})
			vaultExists = raw !== null && raw !== undefined
			const key = await electrobun.rpc?.request.getSecret({
				service: 'koins',
				name: 'alchemy_key',
			})
			if (key) apiKey = key
			if (raw) {
				seed = raw
				await refresh()
			}
		} catch (e) {
			console.log(e)
			error =
				e instanceof Error ? e.message : 'Failed to access keychain'
		} finally {
			ready = true
		}
	}

	const switchNetwork = async (id: NetworkId) => {
		network = id
		if (seed) await refresh()
	}

	const saveVault = async (phrase: string) => {
		loading = true
		error = ''
		try {
			HDNodeWallet.fromPhrase(phrase.trim())
			await electrobun.rpc?.request.setSecret({
				service: 'koins',
				name: 'vault',
				value: phrase.trim(),
			})
			seed = phrase.trim()
			vaultExists = true
			await refresh()
		} catch (e) {
			error = e instanceof Error ? e.message : 'Invalid seed phrase'
		} finally {
			loading = false
		}
	}

	const lock = () => {
		seed = ''
		address = ''
		balance = '0'
		error = ''
		tokenBalances = []
		transactions = []
	}

	const refresh = async () => {
		if (!seed) return
		loading = true
		error = ''
		tokenBalances = []
		try {
			const wallet = HDNodeWallet.fromPhrase(seed)
			address = wallet.address
			const provider = new JsonRpcProvider(net().rpc)
			const nativeBal = await provider.getBalance(wallet.address)
			balance = formatEther(nativeBal)

			const bals = await electrobun.rpc?.request.fetchTokenBalances({
				address: wallet.address,
				chainid: net().chainid,
			})
			tokenBalances = bals ?? []

			fetchTxHistory()
		} catch (e) {
			error =
				e instanceof Error ? e.message : 'Failed to fetch balance'
		} finally {
			loading = false
		}
	}

	const saveApiKey = async (key: string) => {
		await electrobun.rpc?.request.setSecret({
			service: 'koins',
			name: 'alchemy_key',
			value: key,
		})
		apiKey = key
		if (address) await fetchTxHistory()
	}

	const fetchTxHistory = async () => {
		if (!address || !apiKey) {
			transactions = []
			return
		}
		const txs = await electrobun.rpc?.request.fetchTxHistory({
			address,
			chainid: net().chainid,
		})
		transactions = txs ?? []
	}

	return {
		get isLocked() {
			return vaultExists && !seed
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
		get loading() {
			return loading
		},
		get error() {
			return error
		},
		get vaultExists() {
			return vaultExists
		},
		get ready() {
			return ready
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
		refresh,
		init,
		lock,
		saveVault,
		switchNetwork,
		saveApiKey,
		fetchTxHistory,
	}
}
