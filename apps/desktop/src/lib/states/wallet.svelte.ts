import {
	JsonRpcProvider,
	HDNodeWallet,
	formatEther,
	formatUnits,
	Contract,
} from 'ethers'
import { electrobun, type TxEntry } from '$lib/electrobun'

const ERC20_ABI = [
	'function balanceOf(address) view returns (uint256)',
	'function symbol() view returns (string)',
	'function decimals() view returns (uint8)',
]

type DiscoveredToken = {
	address: string
	symbol: string
	decimals: number
}

export const networks = [
	{
		id: 'bsc',
		name: 'BNB Smart Chain',
		rpc: 'https://bsc-dataseed.binance.org',
		symbol: 'BNB',
		chainid: '56',
		explorerUrl: 'https://bscscan.com/tx/',
		tokens: [
			{
				symbol: 'USDC',
				address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
				decimals: 18,
			},
			{
				symbol: 'USDT',
				address: '0x55d398326f99059fF775485246999027B3197955',
				decimals: 18,
			},
		],
	},
	{
		id: 'polygon',
		name: 'Polygon',
		rpc: 'https://polygon-bor.publicnode.com',
		symbol: 'POL',
		chainid: '137',
		explorerUrl: 'https://polygonscan.com/tx/',
		tokens: [
			{
				symbol: 'USDC',
				address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
				decimals: 6,
			},
			{
				symbol: 'USDT',
				address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
				decimals: 6,
			},
		],
	},
	{
		id: 'eth',
		name: 'Ethereum',
		rpc: 'https://ethereum-rpc.publicnode.com',
		symbol: 'ETH',
		chainid: '1',
		explorerUrl: 'https://etherscan.io/tx/',
		tokens: [
			{
				symbol: 'USDC',
				address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
				decimals: 6,
			},
			{
				symbol: 'USDT',
				address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
				decimals: 6,
			},
			{
				symbol: 'BAT',
				address: '0x0D8775F648430679A709E98d2b0Cb6250d2887EF',
				decimals: 18,
			},
		],
	},
] as const

export type NetworkId = (typeof networks)[number]['id']

export type TokenBalance = {
	symbol: string
	balance: string
	address?: string
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
	let etherscanKey = $state('')
	let transactions = $state<TxEntry[]>([])
	let discoveredTokens = $state<DiscoveredToken[]>([])

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
				name: 'etherscan_key',
			})
			if (key) etherscanKey = key
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
		discoveredTokens = []
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
		discoveredTokens = []
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

			const [hardcodedBals, discoveredBals] = await Promise.all([
				Promise.all(
					net().tokens.map(async (t) => {
						try {
							const c = new Contract(t.address, ERC20_ABI, provider)
							const bal = await c.balanceOf(wallet.address)
							return {
								symbol: t.symbol,
								balance: formatUnits(bal, t.decimals),
								address: t.address,
							}
						} catch {
							return { symbol: t.symbol, balance: '0', address: t.address }
						}
					}),
				),
				Promise.all(
					discoveredTokens.map(async (t) => {
						try {
							const c = new Contract(t.address, ERC20_ABI, provider)
							const bal = await c.balanceOf(wallet.address)
							return {
								symbol: t.symbol,
								balance: formatUnits(bal, t.decimals),
								address: t.address,
							}
						} catch {
							return { symbol: t.symbol, balance: '0', address: t.address }
						}
					}),
				),
			])
			tokenBalances = [...hardcodedBals, ...discoveredBals]
			fetchTxHistory()
		} catch (e) {
			error =
				e instanceof Error ? e.message : 'Failed to fetch balance'
		} finally {
			loading = false
		}
	}

	const saveEtherscanKey = async (key: string) => {
		await electrobun.rpc?.request.setSecret({
			service: 'koins',
			name: 'etherscan_key',
			value: key,
		})
		etherscanKey = key
		if (address) await fetchTxHistory()
	}

	const fetchTxHistory = async () => {
		if (!address || !etherscanKey) {
			transactions = []
			return
		}
		const txs = await electrobun.rpc?.request.fetchTxHistory({
			address,
			chainid: net().chainid,
		})
		transactions = txs ?? []

		const seen = new Set(
			net().tokens.map((t) => t.address.toLowerCase()),
		)
		discoveredTokens.forEach((d) => seen.add(d.address.toLowerCase()))

		const newAddrs = [
			...new Set(
				(txs ?? [])
					.filter(
						(t) =>
							t.contractAddress &&
							!seen.has(t.contractAddress.toLowerCase()),
					)
					.map((t) => t.contractAddress!.toLowerCase()),
			),
		]
		if (newAddrs.length === 0) return

		const provider = new JsonRpcProvider(net().rpc)
		const newTokens: DiscoveredToken[] = []

		for (const addr of newAddrs) {
			try {
				const c = new Contract(addr, ERC20_ABI, provider)
				const [symbol, decimals] = await Promise.all([
					c.symbol(),
					c.decimals(),
				])
				if (
					typeof symbol !== 'string' ||
					symbol.length > 12 ||
					/[\s.:/]/.test(symbol)
				) {
					continue
				}
				newTokens.push({ address: addr, symbol, decimals })
			} catch {
				// not ERC-20, skip
			}
		}

		console.log(newTokens)

		if (newTokens.length > 0) {
			discoveredTokens = [...discoveredTokens, ...newTokens]
			const newBals = await Promise.all(
				newTokens.map(async (t) => {
					try {
						const c = new Contract(t.address, ERC20_ABI, provider)
						const bal = await c.balanceOf(address)
						return {
							symbol: t.symbol,
							balance: formatUnits(bal, t.decimals),
							address: t.address,
						}
					} catch {
						return { symbol: t.symbol, balance: '0', address: t.address }
					}
				}),
			)
			tokenBalances = [...tokenBalances, ...newBals]
		}
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
		get tokens() {
			return net().tokens
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
		get etherscanKey() {
			return etherscanKey
		},
		get transactions() {
			return transactions
		},
		get discoveredTokens() {
			return discoveredTokens
		},
		refresh,
		init,
		lock,
		saveVault,
		switchNetwork,
		saveEtherscanKey,
		fetchTxHistory,
	}
}
