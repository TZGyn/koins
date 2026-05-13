import { Electroview } from 'electrobun/view'

export type TxEntry = {
	hash: string
	timeStamp: string
	from: string
	to: string
	value: string
	tokenSymbol?: string
	tokenDecimal?: string
	contractAddress?: string
	pairedValue?: string
	pairedSymbol?: string
	pairedDecimals?: string
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
			openExternal: {
				params: {
					url: string
				}
				response: void
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
