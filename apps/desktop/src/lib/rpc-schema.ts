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

export type XrpWalletInfo = {
	id: string
	name: string
	address: string
	hasPassword: boolean
	vaultKey: string
	createdAt: string
}

export type XrpBalance = {
	address: string
	balance: string
	funded: boolean
}

export type XrpTxEntry = {
	hash: string
	amount: string
	timestamp: string
	direction: 'in' | 'out'
	from: string
	to: string
	destinationTag?: number
	fee: string
	confirmed: boolean
}

export type XrpTxDetails = {
	hash: string
	from: string
	to: string
	amount: string
	fee: string
	timestamp: string
	ledgerIndex: number
	destinationTag?: number
	confirmed: boolean
}

export type XrpSendResult = {
	hash: string
	fee: string
}

export type GeneralRpcRequests = {
	resetApp: { params: {}; response: boolean }
	biometricCanAuth: { params: {}; response: boolean }
	biometricAuth: { params: { reason: string }; response: boolean }
	getSecret: { params: { service: string; name: string }; response: string | null }
	setSecret: { params: { service: string; name: string; value: string }; response: void }
	openExternal: { params: { url: string }; response: void }
	generateQrCode: { params: { text: string; size?: number }; response: string }
	logToFile: { params: { message: string }; response: void }
}

export type MoneroRpcRequests = {
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
	moneroSweepAll: { params: { address: string; priority?: number; accountIndex?: number }; response: MoneroSendResult }
	moneroCreateAccount: { params: { label?: string }; response: { index: number; address: string } }
	moneroCreateSubaddress: { params: { accountIndex: number; label?: string }; response: { index: number; address: string } }
	moneroGetTransferDetails: { params: { txid: string }; response: MoneroTransferDetails | null }
	moneroGetFeeEstimate: { params: {}; response: MoneroFeeEstimate | null }
	fetchMoneroPrice: { params: {}; response: { usd: string } | null }
}

export type XrpRpcRequests = {
	xrpListWallets: { params: {}; response: XrpWalletInfo[] }
	xrpCreateWallet: { params: { name: string; hasPassword?: boolean }; response: { id: string; address: string; seed: string; createdAt: string } }
	xrpImportWallet: { params: { name: string; secret: string; hasPassword?: boolean }; response: { id: string; address: string; createdAt: string } }
	xrpDeleteWallet: { params: { id: string }; response: void }
	xrpGetSeed: { params: { vaultKey: string }; response: string }
	xrpGetBalance: { params: { address: string }; response: XrpBalance }
	xrpGetTransactions: { params: { address: string }; response: XrpTxEntry[] }
	xrpGetTxDetails: { params: { hash: string }; response: XrpTxDetails | null }
	xrpSend: { params: { secret: string; to: string; amount: string; destinationTag?: number }; response: XrpSendResult }
	xrpGetFee: { params: {}; response: { fee: string } | null }
	fetchXrpPrice: { params: {}; response: { usd: string } | null }
}

export type RPC = {
	bun: {
		requests: GeneralRpcRequests & MoneroRpcRequests & XrpRpcRequests
		messages: {}
	}
	webview: {
		requests: {}
		messages: {}
	}
}
