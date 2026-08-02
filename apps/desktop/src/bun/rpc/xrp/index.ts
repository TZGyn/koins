import {
	generateWallet,
	walletFromSecret,
	getXrpWalletList,
	saveXrpWalletList,
	getBalance,
	getTransactions,
	getTxDetails,
	sendPayment,
	getFee,
} from '../../lib/xrp'
import type { XrpWalletInfo } from '../../../lib/rpc-schema'
import { getSecret, setSecret, deleteSecret } from '../../lib/secrets-cache'

const SERVICE = 'koins'

export function createXrpHandlers() {
	return {
		xrpListWallets: async () => {
			console.log('[rpc] xrpListWallets')
			return getXrpWalletList()
		},
		xrpCreateWallet: async ({
			name,
			hasPassword,
		}: {
			name: string
			hasPassword?: boolean
		}) => {
			console.log('[rpc] xrpCreateWallet:', name)
			const { address, seed } = generateWallet()
			const id = crypto.randomUUID()
			const vaultKey = `xrp_seed_${id}`
			await setSecret(SERVICE, vaultKey, seed)
			const wallets = await getXrpWalletList()
			const createdAt = new Date().toISOString()
			const info: XrpWalletInfo = {
				id,
				name,
				address,
				hasPassword: hasPassword ?? false,
				vaultKey,
				createdAt,
			}
			await saveXrpWalletList([...wallets, info])
			console.log('[rpc] xrpCreateWallet complete:', id)
			return { id, address, seed, createdAt }
		},
		xrpImportWallet: async ({
			name,
			secret,
			hasPassword,
		}: {
			name: string
			secret: string
			hasPassword?: boolean
		}) => {
			console.log('[rpc] xrpImportWallet:', name)
			const { address } = walletFromSecret(secret)
			const id = crypto.randomUUID()
			const vaultKey = `xrp_seed_${id}`
			await setSecret(SERVICE, vaultKey, secret.trim())
			const wallets = await getXrpWalletList()
			const createdAt = new Date().toISOString()
			const info: XrpWalletInfo = {
				id,
				name,
				address,
				hasPassword: hasPassword ?? false,
				vaultKey,
				createdAt,
			}
			await saveXrpWalletList([...wallets, info])
			console.log('[rpc] xrpImportWallet complete:', id)
			return { id, address, createdAt }
		},
		xrpDeleteWallet: async ({ id }: { id: string }) => {
			console.log('[rpc] xrpDeleteWallet:', id)
			const wallets = await getXrpWalletList()
			const wallet = wallets.find((w) => w.id === id)
			if (!wallet) throw new Error('Wallet not found')
			await Promise.all([
				deleteSecret(SERVICE, wallet.vaultKey),
				deleteSecret(SERVICE, `xrp_auth_${id}`),
			])
			await saveXrpWalletList(wallets.filter((w) => w.id !== id))
			console.log('[rpc] xrpDeleteWallet complete')
		},
		xrpGetSeed: async ({ vaultKey }: { vaultKey: string }) => {
			console.log('[rpc] xrpGetSeed:', vaultKey)
			const seed = await getSecret(SERVICE, vaultKey)
			if (!seed) throw new Error('Seed not found in keychain')
			return seed
		},
		xrpGetBalance: async ({ address }: { address: string }) => {
			console.log('[rpc] xrpGetBalance:', address)
			return getBalance(address)
		},
		xrpGetTransactions: async ({ address }: { address: string }) => {
			console.log('[rpc] xrpGetTransactions:', address)
			try {
				return await getTransactions(address)
			} catch (e) {
				if (e instanceof Error && e.message.includes('Account not found')) {
					return []
				}
				throw e
			}
		},
		xrpGetTxDetails: async ({ hash }: { hash: string }) => {
			console.log('[rpc] xrpGetTxDetails:', hash)
			return getTxDetails(hash)
		},
		xrpSend: async ({
			secret,
			to,
			amount,
			destinationTag,
		}: {
			secret: string
			to: string
			amount: string
			destinationTag?: number
		}) => {
			console.log('[rpc] xrpSend:', { to, amount, destinationTag })
			const result = await sendPayment(secret, to, amount, destinationTag)
			console.log('[rpc] xrpSend complete:', result.hash)
			return result
		},
		xrpGetFee: async () => {
			console.log('[rpc] xrpGetFee')
			return getFee()
		},
		fetchXrpPrice: async () => {
			try {
				const res = await fetch(
					'https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd',
					{ signal: AbortSignal.timeout(10000) },
				)
				if (!res.ok) return null
				const data = await res.json()
				if (!data?.ripple?.usd) return null
				return { usd: String(data.ripple.usd) }
			} catch (error) {
				console.log('[xrp][price] error:', error)
				return null
			}
		},
	}
}
