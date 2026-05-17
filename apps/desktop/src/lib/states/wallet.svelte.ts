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
] as const

const moneroNetwork = {
	id: 'monero',
	name: 'Monero',
	rpc: '',
	symbol: 'XMR',
	chainid: '',
	explorerUrl: 'https://moneroblocks.info/tx/',
} as const

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

export type AccountType = 'multi' | 'monero'

export const Wallet = () => {
	let accountType = $state<AccountType | null>(null)
	let seed = $state('')
	let address = $state('')
	let balance = $state('0')
	let tokenBalances = $state<TokenBalance[]>([])
	let network = $state<NetworkId>('eth')
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
	let biometricAvailable = $state(false)
	let moneroWalletName = $state('')
	let moneroAccounts = $state<MoneroAccountEntry[]>([])
	let moneroWallets = $state<string[]>([])
	let passwordHash = $state('')

	const net = () => networks.find((n) => n.id === network)!

	async function hashPassword(password: string, salt?: string): Promise<{ salt: string; hash: string }> {
		const s = salt ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('')
		const enc = new TextEncoder()
		const key = await crypto.subtle.importKey('raw', enc.encode(password + s), 'PBKDF2', false, ['deriveBits'])
		const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(s), iterations: 100_000, hash: 'SHA-256' }, key, 256)
		const hash = Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('')
		return { salt: s, hash }
	}

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
			electrobun.rpc.request.getSecret({ service: 'koins', name: 'alchemy_key' }),
		)
		if (keyError) console.log('key error', keyError)
		if (key) apiKey = key

		const [ph] = await tryCatch(
			electrobun.rpc.request.getSecret({ service: 'koins', name: 'vault_password' }),
		)
		if (ph) passwordHash = ph

		await checkMoneroStatus()
		if (moneroInstalled && !moneroRunning && !moneroDownloading) {
			await moneroStart()
			await checkMoneroStatus()
		}
		await checkBiometric()
		ready = true
	}

	const login = async (type: AccountType) => {
		accountType = type
		if (type === 'multi') {
			if (seed) await switchNetwork(network)
		} else if (type === 'monero') {
			if (moneroInstalled && !moneroRunning) {
				await moneroStart()
				await checkMoneroStatus()
			}
			await moneroListWallets()
		}
	}

	const logout = async () => {
		await moneroStop()
		accountType = null
		seed = ''
		address = ''
		balance = '0'
		tokenBalances = []
		transactions = []
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

	const switchNetwork = async (id: NetworkId) => {
		network = id
		if (seed) {
			await refresh()
		}
	}

	const saveVault = async (phrase: string, password?: string) => {
		loading = true
		error = ''
		try {
			HDNodeWallet.fromPhrase(phrase.trim())
			await electrobun.rpc?.request.setSecret({
				service: 'koins',
				name: 'vault',
				value: phrase.trim(),
			})
			if (password) {
				const ph = await hashPassword(password)
				const raw = JSON.stringify(ph)
				await electrobun.rpc?.request.setSecret({
					service: 'koins',
					name: 'vault_password',
					value: raw,
				})
				passwordHash = raw
			}
			seed = phrase.trim()
			vaultExists = true
			await refresh()
		} catch (e) {
			error = e instanceof Error ? e.message : 'Invalid seed phrase'
		} finally {
			loading = false
		}
	}

	const checkBiometric = async () => {
		if (!electrobun.rpc) return
		const [ok] = await tryCatch(
			electrobun.rpc.request.biometricCanAuth({}),
		)
		biometricAvailable = ok === true
	}

	const unlockWithBiometrics = async () => {
		if (!electrobun.rpc) return false
		const [authed] = await tryCatch(
			electrobun.rpc.request.biometricAuth({ reason: 'Unlock wallet' }),
		)
		if (!authed) return false
		return loadSeed()
	}

	const unlockWithPassword = async (password: string) => {
		if (!passwordHash) return false
		try {
			const { salt, hash } = JSON.parse(passwordHash)
			const { hash: check } = await hashPassword(password, salt)
			if (check !== hash) return false
			return await loadSeed()
		} catch {
			return false
		}
	}

	const resetApp = async () => {
		if (!electrobun.rpc) return false
		const [ok] = await tryCatch(
			electrobun.rpc.request.resetApp({}),
		)
		if (!ok) return false
		seed = ''
		address = ''
		balance = '0'
		error = ''
		tokenBalances = []
		transactions = []
		apiKey = ''
		vaultExists = false
		passwordHash = ''
		return true
	}

	const setPassword = async (password: string) => {
		if (!electrobun.rpc) return
		const ph = await hashPassword(password)
		const raw = JSON.stringify(ph)
		await electrobun.rpc.request.setSecret({
			service: 'koins',
			name: 'vault_password',
			value: raw,
		})
		passwordHash = raw
	}

	async function loadSeed() {
		if (!electrobun.rpc) return false
		const [raw] = await tryCatch(
			electrobun.rpc.request.getSecret({
				service: 'koins',
				name: 'vault',
			}),
		)
		if (!raw) return false
		seed = raw
		await refresh()
		return true
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

	const moneroOpenExistingWallet = async (name: string, password?: string) => {
		if (!electrobun.rpc) throw new Error('RPC not available')
		const pw = password ?? await moneroGetStoredPassword(name)
		if (!pw) throw new Error('Password required')
		await electrobun.rpc.request.moneroOpenWallet({ name, password: pw })
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

	const moneroCreateWallet = async (name: string, password: string, storePw?: boolean) => {
		if (!electrobun.rpc) throw new Error('RPC not available')
		const result = await electrobun.rpc.request.moneroCreateWallet({ name, password })
		moneroWalletName = name
		moneroWalletOpen = true
		moneroAddress = result.address
		if (storePw) await moneroStorePassword(name, password)
		await moneroRefresh()
		return result
	}

	const moneroRestoreWallet = async (name: string, password: string, mnemonic: string, restoreHeight?: number, storePw?: boolean) => {
		if (!electrobun.rpc) throw new Error('RPC not available')
		const result = await electrobun.rpc.request.moneroRestoreWallet({
			name, password, mnemonic, restoreHeight,
		})
		moneroWalletName = name
		moneroWalletOpen = true
		moneroAddress = result.address
		if (storePw) await moneroStorePassword(name, password)
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
			return accountType === 'multi' && vaultExists && !seed
		},
		get accountType() { return accountType },
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
		get moneroNetwork() { return moneroNetwork },
		get evmNetworks() { return networks },
		get apiKey() { return apiKey },
		get transactions() { return transactions },
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
		get biometricAvailable() { return biometricAvailable },
		get passwordSet() { return !!passwordHash },
		refresh,
		init,
		login,
		logout,
		lock,
		unlockWithBiometrics,
		unlockWithPassword,
		setPassword,
		resetApp,
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
		moneroGetStoredPassword,
		moneroStorePassword,
	}
}

export const wallet = Wallet()
