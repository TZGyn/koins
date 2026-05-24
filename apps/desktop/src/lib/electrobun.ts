import { Electroview } from 'electrobun/view'
import type { RPC } from './rpc-schema'
export type {
	MoneroBalance,
	MoneroTxEntry,
	MoneroBinaryStatus,
	MoneroWalletStatus,
	MoneroSubaddressEntry,
	MoneroAccountEntry,
	MoneroSendResult,
	TxEntry,
	TransactionDetails,
	TokenBalanceResult,
	EvmWalletInfo,
} from './rpc-schema'

const rpc = Electroview.defineRPC<RPC>({
	maxRequestTime: 10000,
	handlers: {
		requests: {},
		messages: {},
	},
})
export const electrobun = new Electroview({ rpc })
