import { Electroview } from 'electrobun/view'

export type EtherscanTx = {
	blockNumber: string
	timeStamp: string
	hash: string
	from: string
	to: string
	value: string
	isError: string
	txreceipt_status: string
	gas: string
	gasPrice: string
	input: string
	contractAddress: string
	gasUsed: string
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
				response: Promise<EtherscanTx[]>
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
