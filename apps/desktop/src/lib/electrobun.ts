import { Electroview } from 'electrobun/view'

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

export type MoneroAccountEntry = {
	index: number
	primaryAddress: string
	label: string
	balance: string
	unlockedBalance: string
	tag?: string
	subaddresses: MoneroSubaddressEntry[]
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
}

export type TokenBalanceResult = {
	symbol: string
	balance: string
	contractAddress: string
	logo?: string
}

type RPC = {
	bun: {
		requests: {
			getSecret: {
				params: {
					service: string
					name: string
				}
				response: string | null
			}
			setSecret: {
				params: {
					service: string
					name: string
					value: string
				}
				response: void
			}
			fetchTxHistory: {
				params: {
					address: string
					chainid: string
				}
				response: TxEntry[]
			}
			fetchTokenBalances: {
				params: {
					address: string
					chainid: string
				}
				response: TokenBalanceResult[]
			}
			fetchTransactionDetails: {
				params: {
					hash: string
					chainid: string
				}
				response: TransactionDetails | null
			}
			openExternal: {
				params: {
					url: string
				}
				response: void
			}
			moneroBinaryStatus: {
				params: {}
				response: MoneroBinaryStatus
			}
			moneroDownloadBinary: {
				params: {}
				response: void
			}
			moneroStart: {
				params: {
					daemonAddress?: string
				}
				response: MoneroWalletStatus
			}
			moneroStop: {
				params: {}
				response: void
			}
			moneroCreateWallet: {
				params: {
					name: string
					password: string
				}
				response: {
					mnemonic: string
					address: string
				}
			}
			moneroRestoreWallet: {
				params: {
					name: string
					password: string
					mnemonic: string
					restoreHeight?: number
				}
				response: {
					address: string
				}
			}
			moneroOpenWallet: {
				params: {
					name: string
					password: string
				}
				response: void
			}
			moneroGetBalance: {
				params: {}
				response: MoneroBalance
			}
			moneroGetTransactions: {
				params: {}
				response: MoneroTxEntry[]
			}
			moneroWalletStatus: {
				params: {}
				response: MoneroWalletStatus
			}
			moneroGetAccounts: {
				params: {}
				response: MoneroAccountEntry[]
			}
			moneroListWallets: {
				params: {}
				response: string[]
			}
		}
		messages: {}
	}
	webview: {
		requests: {}
		messages: {}
	}
}

const rpc = Electroview.defineRPC<RPC>({
	maxRequestTime: 10000,
	handlers: {
		requests: {},
		messages: {},
	},
})
export const electrobun = new Electroview({ rpc })
