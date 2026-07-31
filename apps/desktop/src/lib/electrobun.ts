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
	MoneroTransferDetails,
	XrpWalletInfo,
	XrpBalance,
	XrpTxEntry,
	XrpTxDetails,
	XrpSendResult,
} from './rpc-schema'

const rpc = Electroview.defineRPC<RPC>({
	maxRequestTime: 10000,
	handlers: {
		requests: {},
		messages: {},
	},
})
export const electrobun = new Electroview({ rpc })

export async function frontendLog(message: string) {
	try {
		await electrobun.rpc?.request.logToFile({ message: `[FE] ${message}` })
	} catch {}
}

export async function frontendLogError(message: string, err?: unknown) {
	const detail = err instanceof Error ? err.stack || err.message : String(err ?? '')
	await frontendLog(`[ERROR] ${message} — ${detail}`)
}
