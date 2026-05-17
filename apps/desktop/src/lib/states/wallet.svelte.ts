import { JsonRpcProvider, HDNodeWallet, formatEther } from 'ethers'
import { electrobun, type TxEntry, type MoneroTxEntry, type MoneroAccountEntry } from '$lib/electrobun'
import { tryCatch } from '@koins/utils'

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
	{
		id: 'monero',
		name: 'Monero',
		rpc: '',
		symbol: 'XMR',
		chainid: '',
		explorerUrl: 'https://moneroblocks.info/tx/',
	},
] as const

export type NetworkId = (typeof networks)[number]['id']

export type TokenBalance = {
	symbol: string
	balance: string
	contractAddress: string
	logo?: string
}

export const atomicToXmr = (atomic: string): string => {
	const n = BigInt(atomic)
	const whole = n / 10_000_000_000_000n
	const frac = (n % 10_000_000_000_000n).toString().padStart(12, '0').replace(/0+$/, '')
	return frac ? `${whole}.${frac}` : `${whole}`
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

	let moneroRunning = $state(false)
	let moneroWalletOpen = $state(false)
	let moneroConnected = $state(false)
	let moneroBalAtomic = $state('0')
	let moneroUnlockedAtomic = $state('0')
	let moneroAddress = $state('')
	let moneroHeight = $state(0)
	let moneroDaemonHeight = $state(0)
	let moneroTxs = $state<MoneroTxEntry[]>([])
	let moneroInstalled = $state(false)
	let moneroDownloading = $state(false)
	let moneroWalletName = $state('')
	let moneroAccounts = $state<MoneroAccountEntry[]>([])
	let moneroWallets = $state<string[]>([])

	const net = () => networks.find((n) => n.id === network)!

	const isMonero = () => network === 'monero'

	const init = async () => {
		if (!electrobun.rpc) return
		const [raw, rawError] = await tryCatch(
			electrobun.rpc.request.getSecret({
				service: 'koins',
				name: 'vault',
			}),
		)

		if (rawError) {
			console.log('Raw Error:', rawError)
		}

		vaultExists = raw !== null && raw !== undefined
		const [key, keyError] = await tryCatch(
			electrobun.rpc?.request.getSecret({
				service: 'koins',
				name: 'alchemy_key',
			}),
		)

		if (keyError) {
			console.log('key error', keyError)
		}

		if (key) apiKey = key
		if (raw) {
			seed = raw
			await refresh()
		}
		try {
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
		if (id === 'monero') {
			await checkMoneroStatus()
			if (moneroInstalled && !moneroRunning) {
				await moneroStart()
				await checkMoneroStatus()
			}
			await moneroListWallets()
		} else if (seed) {
			await refresh()
		}
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
		if (!seed || !electrobun.rpc) return
		loading = true
		error = ''
		tokenBalances = []
		const wallet = HDNodeWallet.fromPhrase(seed)
		address = wallet.address
		const provider = new JsonRpcProvider(net().rpc)
		const [nativeBal, nativeBalError] = await tryCatch(
			provider.getBalance(wallet.address),
		)

		if (nativeBalError) {
			loading = false
			console.log('Native Balance Error', nativeBalError)
			return
		}
		balance = formatEther(nativeBal)

		const [bals, balsError] = await tryCatch(
			electrobun.rpc.request.fetchTokenBalances({
				address: wallet.address,
				chainid: net().chainid,
			}),
		)

		if (balsError) {
			console.log('Bals Error', balsError)
			error = balsError.message
		}
		tokenBalances = bals ?? []

		fetchTxHistory()
		loading = false
	}

	const moneroFetchAccounts = async () => {
		if (!electrobun.rpc) return false
		const [accounts, error] = await tryCatch(
			electrobun.rpc.request.moneroGetAccounts({}),
		)
		if (error) {
			console.log('moneroFetchAccounts error:', error)
			return false
		}
		moneroAccounts = accounts ?? []
		return true
	}

	const moneroListWallets = async () => {
		if (!electrobun.rpc) return
		const [wallets] = await tryCatch(
			electrobun.rpc.request.moneroListWallets({}),
		)
		moneroWallets = wallets ?? []
	}

	const moneroOpenExistingWallet = async (name: string, password: string) => {
		if (!electrobun.rpc) throw new Error('RPC not available')
		await electrobun.rpc.request.moneroOpenWallet({ name, password })
		moneroWalletName = name
		moneroWalletOpen = true
		await moneroRefresh()
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

	const checkMoneroStatus = async () => {
		if (!electrobun.rpc) return
		const [binStatus] = await tryCatch(
			electrobun.rpc.request.moneroBinaryStatus({}),
		)
		if (binStatus) {
			moneroInstalled = binStatus.installed
			moneroDownloading = binStatus.downloading
		}
		const [status] = await tryCatch(
			electrobun.rpc.request.moneroWalletStatus({}),
		)
		if (status) {
			moneroRunning = status.running
			moneroWalletOpen = status.walletOpen
			moneroConnected = status.connected
		}
	}

	const moneroDownload = async () => {
		if (!electrobun.rpc) return
		moneroDownloading = true
		try {
			await electrobun.rpc.request.moneroDownloadBinary({})
			moneroInstalled = true
		} finally {
			moneroDownloading = false
		}
	}

	const moneroStart = async () => {
		if (!electrobun.rpc) return
		const status = await electrobun.rpc.request.moneroStart({})
		moneroRunning = status.running
		moneroConnected = status.connected
	}

	const moneroStop = async () => {
		if (!electrobun.rpc) return
		await electrobun.rpc.request.moneroStop({})
		moneroRunning = false
		moneroWalletOpen = false
		moneroConnected = false
		moneroAddress = ''
		moneroBalAtomic = '0'
		moneroUnlockedAtomic = '0'
		moneroTxs = []
		moneroAccounts = []
		moneroWallets = []
	}

	const moneroCreateWallet = async (name: string, password: string) => {
		if (!electrobun.rpc) throw new Error('RPC not available')
		const result = await electrobun.rpc.request.moneroCreateWallet({ name, password })
		moneroWalletName = name
		moneroWalletOpen = true
		moneroAddress = result.address
		await moneroRefresh()
		return result
	}

	const moneroRestoreWallet = async (name: string, password: string, mnemonic: string, restoreHeight?: number) => {
		if (!electrobun.rpc) throw new Error('RPC not available')
		const result = await electrobun.rpc.request.moneroRestoreWallet({
			name, password, mnemonic, restoreHeight,
		})
		moneroWalletName = name
		moneroWalletOpen = true
		moneroAddress = result.address
		await moneroRefresh()
	}

	const moneroOpenWallet = async (name: string, password: string) => {
		if (!electrobun.rpc) return
		await electrobun.rpc.request.moneroOpenWallet({ name, password })
		moneroWalletName = name
		moneroWalletOpen = true
		await moneroRefresh()
	}

	const moneroRefresh = async () => {
		if (!electrobun.rpc) return
		loading = true
		try {
			const [bal] = await tryCatch(
				electrobun.rpc.request.moneroGetBalance({}),
			)
			if (bal) {
				moneroBalAtomic = bal.balance
				moneroUnlockedAtomic = bal.unlocked
				moneroAddress = bal.address
				moneroHeight = bal.height
				moneroDaemonHeight = bal.daemonHeight
			}
			const [txs] = await tryCatch(
				electrobun.rpc.request.moneroGetTransactions({}),
			)
			moneroTxs = txs ?? []
			await moneroFetchAccounts()
		} catch (e) {
			console.log('monero refresh error', e)
			error = e instanceof Error ? e.message : 'Monero refresh failed'
		} finally {
			loading = false
		}
	}

	return {
		get isLocked() {
			return vaultExists && !seed && network !== 'monero'
		},
		get seed() { return seed },
		get address() { return address },
		get balance() { return balance },
		get tokenBalances() { return tokenBalances },
		get network() { return network },
		get chainid() { return net().chainid },
		get networkName() { return net().name },
		get symbol() { return net().symbol },
		get explorerUrl() { return net().explorerUrl },
		get loading() { return loading },
		get error() { return error },
		get vaultExists() { return vaultExists },
		get ready() { return ready },
		get networks() { return networks },
		get apiKey() { return apiKey },
		get transactions() { return transactions },
		isMonero,
		get moneroRunning() { return moneroRunning },
		get moneroWalletOpen() { return moneroWalletOpen },
		get moneroConnected() { return moneroConnected },
		get moneroBalAtomic() { return moneroBalAtomic },
		get moneroUnlockedAtomic() { return moneroUnlockedAtomic },
		get moneroBalance() { return atomicToXmr(moneroBalAtomic) },
		get moneroUnlocked() { return atomicToXmr(moneroUnlockedAtomic) },
		get moneroAddress() { return moneroAddress },
		get moneroHeight() { return moneroHeight },
		get moneroDaemonHeight() { return moneroDaemonHeight },
		get moneroTxs() { return moneroTxs },
		get moneroInstalled() { return moneroInstalled },
		get moneroDownloading() { return moneroDownloading },
		get moneroWalletName() { return moneroWalletName },
		get moneroAccounts() { return moneroAccounts },
		get moneroWallets() { return moneroWallets },
		refresh,
		init,
		lock,
		saveVault,
		switchNetwork,
		saveApiKey,
		fetchTxHistory,
		checkMoneroStatus,
		moneroDownload,
		moneroStart,
		moneroStop,
		moneroCreateWallet,
		moneroRestoreWallet,
		moneroOpenWallet,
		moneroRefresh,
		moneroFetchAccounts,
		moneroListWallets,
		moneroOpenExistingWallet,
	}
}

export const wallet = Wallet()
