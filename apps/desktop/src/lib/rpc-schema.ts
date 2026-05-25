export type MoneroBalance = {
	balance: string
	unlocked: string
	address: string
	height: number
	daemonHeight: number
}

export type MoneroTxEntry = {
	hash: string
	amount: string
	timestamp: string
	direction: 'in' | 'out'
	height: number
	note?: string
}

export type MoneroBinaryStatus = {
	installed: boolean
	downloading: boolean
	error?: string
}

export type MoneroWalletStatus = {
	running: boolean
	walletOpen: boolean
	walletName?: string
	connected: boolean
}

export type MoneroSubaddressEntry = {
	accountIndex: number
	index: number
	address: string
	label: string
	balance: string
	unlockedBalance: string
	numUnspentOutputs: number
	isUsed: boolean
	numBlocksToUnlock: number
}

export type MoneroSendResult = {
	txHash: string
	fee: string
	amount: string
}

export type MoneroTransferDetails = {
	hash: string
	direction: 'in' | 'out'
	amount: string
	fee: string
	height: number
	timestamp: string
	confirmations: number
	unlockTime: number
	locked: boolean
	doubleSpend: boolean
	note?: string
	paymentId: string
	destinations: { address: string; amount: string }[]
	subaddrIndices: { major: number; minor: number }[]
}

export type MoneroAccountEntry = {
	index: number
	primaryAddress: string
	label: string
	balance: string
	unlockedBalance: string
	tag?: string
	subaddresses: MoneroSubaddressEntry[]
}

export type MoneroFeeEstimate = {
	fee: string
	fees: string[]
	estimatedFee: string
}

export type TxEntry = {
	hash: string
	timeStamp: string
	from: string
	to: string
	value: string
	tokenSymbol?: string
	tokenDecimal?: string
	contractAddress?: string
	logo?: string
	pairedValue?: string
	pairedSymbol?: string
	pairedDecimals?: string
	pairedContractAddress?: string
	pairedLogo?: string
}

export type TransactionDetails = {
	hash: string
	from: string
	to: string | null
	value: string
	blockNumber: string | null
	fee: string
	gasPrice: string
	status: 'success' | 'reverted'
	type: string
	nonce: number
	input: string
	pairedValue?: string
	pairedSymbol?: string
	pairedDecimals?: string
	pairedContractAddress?: string
	pairedLogo?: string
}

export type TokenBalanceResult = {
	symbol: string
	balance: string
	contractAddress: string
	logo?: string
}

export type TokenPriceEntry = {
	symbol: string
	currency: string
	value: string
	lastUpdatedAt: string
	network?: string
	address?: string
}

export type EvmWalletInfo = {
	id: string
	name: string
	hasPassword: boolean
	vaultKey: string
	createdAt: string
}

export type RPC = {
	bun: {
		requests: {
			resetApp: { params: {}; response: boolean }
			biometricCanAuth: { params: {}; response: boolean }
			biometricAuth: { params: { reason: string }; response: boolean }
			getSecret: { params: { service: string; name: string }; response: string | null }
			setSecret: { params: { service: string; name: string; value: string }; response: void }
			fetchTxHistory: { params: { address: string; chainid: string }; response: TxEntry[] }
			fetchCachedTxHistory: { params: { address: string; chainid: string }; response: TxEntry[] }
			syncTxHistory: { params: { address: string; chainid: string }; response: void }
			flushTxCache: { params: {}; response: void }
			setAutoSync: { params: { address: string; chainid: string } | null; response: void }
			fetchTokenBalances: { params: { address: string; chainid: string }; response: TokenBalanceResult[] }
			fetchTransactionDetails: { params: { hash: string; chainid: string; address?: string }; response: TransactionDetails | null }
			openExternal: { params: { url: string }; response: void }
			generateQrCode: { params: { text: string; size?: number }; response: string }
			moneroBinaryStatus: { params: {}; response: MoneroBinaryStatus }
			moneroDownloadBinary: { params: {}; response: void }
			moneroStart: { params: { daemonAddress?: string }; response: MoneroWalletStatus }
			moneroStop: { params: {}; response: void }
			moneroCreateWallet: { params: { name: string; password: string }; response: { mnemonic: string; address: string } }
			moneroRestoreWallet: { params: { name: string; password: string; mnemonic: string; restoreHeight?: number }; response: { address: string } }
			moneroOpenWallet: { params: { name: string; password: string }; response: void }
			moneroGetBalance: { params: {}; response: MoneroBalance }
			moneroGetTransactions: { params: { accountIndex?: number }; response: MoneroTxEntry[] }
			moneroWalletStatus: { params: {}; response: MoneroWalletStatus }
			moneroGetAccounts: { params: {}; response: MoneroAccountEntry[] }
			moneroListWallets: { params: {}; response: string[] }
			moneroTransfer: { params: { address: string; amount: string; priority?: number; accountIndex?: number }; response: MoneroSendResult }
			moneroGetTransferDetails: { params: { txid: string }; response: MoneroTransferDetails | null }
			moneroGetFeeEstimate: { params: {}; response: MoneroFeeEstimate | null }
			evmCreateWallet: { params: { name: string; phrase: string; passwordHash?: string }; response: { id: string; name: string; createdAt: string } }
			evmListWallets: { params: {}; response: EvmWalletInfo[] }
			evmGetSeed: { params: { vaultKey: string }; response: string }
			evmDeleteWallet: { params: { id: string }; response: void }
			fetchTokenPrices: { params: { symbols?: string[]; addresses?: { network: string; address: string }[] }; response: TokenPriceEntry[] }
			fetchGasPrice: { params: { chainid: string }; response: string | null }
		}
		messages: {}
	}
	webview: {
		requests: {}
		messages: {
			transfersUpdate: { count: number; chainid: string; address: string }
		}
	}
}
