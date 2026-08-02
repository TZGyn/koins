import {
	Client,
	Wallet,
	xrpToDrops,
	dropsToXrp,
	isValidClassicAddress,
} from 'xrpl'
import type {
	XrpBalance,
	XrpTxDetails,
	XrpTxEntry,
	XrpWalletInfo,
} from '../../../lib/rpc-schema'
import { getSecret, setSecret } from '../secrets-cache'

const SERVER = 'wss://s1.ripple.com'
const RIPPLE_EPOCH = 946684800
const WALLET_LIST_KEY = 'xrp_wallets'
const SERVICE = 'koins'

let client: Client | null = null

export async function getClient(): Promise<Client> {
	if (client?.isConnected()) return client
	client = new Client(SERVER)
	await client.connect()
	return client
}

export function isValidAddress(address: string): boolean {
	return isValidClassicAddress(address)
}

export function generateWallet(): { address: string; seed: string } {
	const wallet = Wallet.generate()
	return { address: wallet.classicAddress, seed: wallet.seed! }
}

export function walletFromSecret(secret: string): { address: string } {
	const s = secret.trim()
	try {
		return { address: Wallet.fromSeed(s).classicAddress }
	} catch {
		return { address: Wallet.fromMnemonic(s).classicAddress }
	}
}

export function walletForSigning(secret: string): Wallet {
	const s = secret.trim()
	try {
		return Wallet.fromSeed(s)
	} catch {
		return Wallet.fromMnemonic(s)
	}
}

export async function getXrpWalletList(): Promise<XrpWalletInfo[]> {
	const raw = await getSecret(SERVICE, WALLET_LIST_KEY)
	if (!raw) return []
	try {
		return JSON.parse(raw)
	} catch {
		return []
	}
}

export async function saveXrpWalletList(
	wallets: XrpWalletInfo[],
): Promise<void> {
	await setSecret(SERVICE, WALLET_LIST_KEY, JSON.stringify(wallets))
}

export async function getBalance(address: string): Promise<XrpBalance> {
	const c = await getClient()
	try {
		const balance = await c.getXrpBalance(address)
		return { address, balance: String(balance), funded: true }
	} catch (e) {
		if (e instanceof Error && e.message.includes('Account not found')) {
			return { address, balance: '0', funded: false }
		}
		throw e
	}
}

function dropsAmount(value: unknown): string {
	if (typeof value !== 'string') return '0'
	return String(dropsToXrp(value))
}

export async function getTransactions(address: string): Promise<XrpTxEntry[]> {
	const c = await getClient()
	const res = await c.request({
		command: 'account_tx',
		account: address,
		ledger_index_min: -1,
		ledger_index_max: -1,
		limit: 25,
	})
	const entries: XrpTxEntry[] = []
	for (const entry of res.result.transactions as any[]) {
		const tx = entry.tx_json ?? entry.tx
		if (!tx || tx.TransactionType !== 'Payment') continue
		const meta = entry.meta ?? entry.metaData ?? {}
		if (meta.TransactionResult && meta.TransactionResult !== 'tesSUCCESS')
			continue
		const delivered = meta.delivered_amount ?? meta.DeliveredAmount ?? tx.Amount
		entries.push({
			hash: entry.hash ?? tx.hash,
			amount: dropsAmount(delivered),
			timestamp: tx.date ? String(tx.date + RIPPLE_EPOCH) : '0',
			direction: tx.Destination === address ? 'in' : 'out',
			from: tx.Account,
			to: tx.Destination,
			destinationTag: tx.DestinationTag,
			fee: dropsAmount(tx.Fee),
			confirmed: entry.validated === true,
		})
	}
	return entries
}

export async function getTxDetails(
	hash: string,
): Promise<XrpTxDetails | null> {
	const c = await getClient()
	try {
		const res = await c.request({ command: 'tx', transaction: hash })
		const d = res.result as any
		const tx = d.tx_json ?? d
		if (tx.TransactionType !== 'Payment') return null
		const meta = d.meta ?? {}
		const delivered = meta.delivered_amount ?? meta.DeliveredAmount ?? tx.Amount
		return {
			hash: d.hash ?? hash,
			from: tx.Account,
			to: tx.Destination,
			amount: dropsAmount(delivered),
			fee: dropsAmount(tx.Fee),
			timestamp: tx.date ? String(tx.date + RIPPLE_EPOCH) : '0',
			ledgerIndex: d.ledger_index ?? 0,
			destinationTag: tx.DestinationTag,
			confirmed: d.validated === true,
		}
	} catch {
		return null
	}
}

export async function sendPayment(
	secret: string,
	to: string,
	amount: string,
	destinationTag?: number,
): Promise<{ hash: string; fee: string }> {
	if (!isValidClassicAddress(to)) throw new Error('Invalid XRP address')
	const wallet = walletForSigning(secret)
	const c = await getClient()
	const prepared = await c.autofill({
		TransactionType: 'Payment',
		Account: wallet.classicAddress,
		Amount: xrpToDrops(amount),
		Destination: to,
		...(destinationTag !== undefined ? { DestinationTag: destinationTag } : {}),
	})
	const signed = wallet.sign(prepared)
	const result = await c.submit(signed.tx_blob)
	const engineResult = (result.result as any).engine_result
	if (engineResult !== 'tesSUCCESS') {
		const msg =
			(result.result as any).engine_result_message ?? 'Transaction failed'
		throw new Error(`${engineResult}: ${msg}`)
	}
	return { hash: signed.hash, fee: String(dropsToXrp((prepared as any).Fee ?? '0')) }
}

export async function getFee(): Promise<{ fee: string } | null> {
	try {
		const c = await getClient()
		const res = await c.request({ command: 'fee' })
		return { fee: String(dropsToXrp(res.result.drops.open_ledger_fee)) }
	} catch {
		return null
	}
}
