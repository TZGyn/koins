import { Electroview } from 'electrobun/view'

export type TxEntry = {
	hash: string
	timeStamp: string
	from: string
	to: string
	value: string
	isError?: string
	tokenSymbol?: string
	tokenName?: string
	tokenDecimal?: string
	contractAddress?: string
}

type RPC = {
	bun: {
		requests: {
			getSecret: {
				params: {
					service: string
					name: string
				}
				response: Promise<string | null>
			}
			setSecret: {
				params: {
					service: string
					name: string
					value: string
				}
				response: Promise<void>
			}
			fetchTxHistory: {
				params: {
					address: string
					chainid: string
					page?: number
					offset?: number
				}
				response: Promise<TxEntry[]>
			}
			openExternal: {
				params: {
					url: string
				}
				response: Promise<void>
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
	handlers: {
		requests: {},
		messages: {},
	},
})
export const electrobun = new Electroview({ rpc })
