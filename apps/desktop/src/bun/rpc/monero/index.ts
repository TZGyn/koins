import {
	isBinaryInstalled,
	downloadBinary,
	createMoneroWalletState,
	start as walletStart,
	stop as walletStop,
	createWallet as walletCreate,
	restoreWallet as walletRestore,
	openWallet as walletOpen,
	getBalance as walletGetBalance,
	getAddress as walletGetAddress,
	getTransactions as walletGetTransactions,
	getAccounts as walletGetAccounts,
	listWallets,
	getTransferDetails as walletGetTransferDetails,
	getHeight as walletGetHeight,
	getDaemonHeight as walletGetDaemonHeight,
	getFeeEstimate as walletGetFeeEstimate,
	transfer as walletTransfer,
	isWalletOpen,
	isConnected,
} from '../../lib/monero'
import type { MoneroWalletState } from '../../lib/monero'

export function createMoneroHandlers(state: {
	manager: MoneroWalletState | null
	downloading: boolean
}) {
	return {
		moneroBinaryStatus: async () => {
			const status = {
				installed: isBinaryInstalled(),
				downloading: state.downloading,
			}
			console.log('[rpc] moneroBinaryStatus:', status)
			return status
		},
		moneroDownloadBinary: async () => {
			console.log('[rpc] moneroDownloadBinary: starting download...')
			state.downloading = true
			try {
				await downloadBinary()
				console.log('[rpc] moneroDownloadBinary: complete')
			} catch (e) {
				console.log('[rpc] moneroDownloadBinary failed:', e)
				throw e
			} finally {
				state.downloading = false
			}
		},
		moneroStart: async ({
			daemonAddress,
		}: {
			daemonAddress?: string
		}) => {
			console.log('[rpc] moneroStart:', { daemonAddress })
			if (!state.manager) {
				state.manager = createMoneroWalletState()
			}
			try {
				await walletStart(state.manager, daemonAddress)
			} catch (e) {
				console.log('[rpc] moneroStart error:', e)
				return { running: false, walletOpen: false, connected: false }
			}
			const connected = await isConnected(state.manager)
			console.log('[rpc] moneroStart complete, connected:', connected)
			return { running: true, walletOpen: false, connected }
		},
		moneroStop: async () => {
			console.log('[rpc] moneroStop')
			if (state.manager) {
				await walletStop(state.manager)
				state.manager = null
			}
		},
		moneroCreateWallet: async ({
			name,
			password,
		}: {
			name: string
			password: string
		}) => {
			console.log('[rpc] moneroCreateWallet:', name)
			if (!state.manager)
				throw new Error('Monero wallet RPC not started')
			const result = await walletCreate(state.manager, name, password)
			console.log('[rpc] moneroCreateWallet complete')
			return result
		},
		moneroRestoreWallet: async ({
			name,
			password,
			mnemonic,
			restoreHeight,
		}: {
			name: string
			password: string
			mnemonic: string
			restoreHeight?: number
		}) => {
			console.log('[rpc] moneroRestoreWallet:', name)
			if (!state.manager)
				throw new Error('Monero wallet RPC not started')
			await walletRestore(
				state.manager,
				name,
				password,
				mnemonic,
				restoreHeight,
			)
			const address = await walletGetAddress(state.manager)
			console.log(
				'[rpc] moneroRestoreWallet complete, address:',
				address,
			)
			return { address }
		},
		moneroOpenWallet: async ({
			name,
			password,
		}: {
			name: string
			password: string
		}) => {
			console.log('[rpc] moneroOpenWallet:', name)
			if (!state.manager)
				throw new Error('Monero wallet RPC not started')
			await walletOpen(state.manager, name, password)
		},
		moneroGetBalance: async () => {
			console.log('[rpc] moneroGetBalance')
			if (!state.manager)
				throw new Error('Monero wallet RPC not started')
			const { balance, unlocked } = await walletGetBalance(
				state.manager,
			)
			const address = await walletGetAddress(state.manager)
			const height = await walletGetHeight(state.manager)
			const daemonHeight = await walletGetDaemonHeight(state.manager)
			console.log('[rpc] balance:', {
				balance: balance.toString(),
				unlocked: unlocked.toString(),
				address,
				height,
				daemonHeight,
			})
			return {
				balance: balance.toString(),
				unlocked: unlocked.toString(),
				address,
				height,
				daemonHeight,
			}
		},
		moneroGetTransactions: async ({
			accountIndex,
		}: {
			accountIndex?: number
		}) => {
			console.log('[rpc] moneroGetTransactions', { accountIndex })
			if (!state.manager)
				throw new Error('Monero wallet RPC not started')
			const txs = await walletGetTransactions(
				state.manager,
				accountIndex,
			)
			console.log(`[rpc] moneroGetTransactions: ${txs.length} txs`)
			return txs
		},
		moneroWalletStatus: async () => {
			if (!state.manager) {
				console.log('[rpc] moneroWalletStatus: not running')
				return { running: false, walletOpen: false, connected: false }
			}
			const connected = await isConnected(state.manager)
			const walletOpen = await isWalletOpen(state.manager)
			console.log(
				'[rpc] moneroWalletStatus: running, walletOpen:',
				walletOpen,
				'connected:',
				connected,
			)
			return { running: true, walletOpen, connected }
		},
		moneroGetAccounts: async () => {
			console.log('[rpc] moneroGetAccounts')
			if (!state.manager)
				throw new Error('Monero wallet RPC not started')
			const accounts = await walletGetAccounts(state.manager)
			console.log(
				`[rpc] moneroGetAccounts: ${accounts.length} accounts`,
			)
			return accounts
		},
		moneroListWallets: async () => {
			console.log('[rpc] moneroListWallets')
			if (!state.manager)
				throw new Error('Monero wallet RPC not started')
			const wallets = listWallets()
			console.log(
				`[rpc] moneroListWallets: ${wallets.join(', ') || 'none'}`,
			)
			return wallets
		},
		moneroTransfer: async ({
			address,
			amount,
			priority,
			accountIndex,
		}: {
			address: string
			amount: string
			priority?: number
			accountIndex?: number
		}) => {
			console.log('[rpc] moneroTransfer:', {
				address,
				amount,
				priority,
			})
			if (!state.manager)
				throw new Error('Monero wallet RPC not started')
			const result = await walletTransfer(
				state.manager,
				address,
				BigInt(amount),
				priority ?? 0,
				accountIndex ?? 0,
			)
			console.log('[rpc] moneroTransfer complete:', result.txHash)
			return result
		},
		moneroGetTransferDetails: async ({ txid }: { txid: string }) => {
			console.log('[rpc] moneroGetTransferDetails:', txid)
			if (!state.manager)
				throw new Error('Monero wallet RPC not started')
			const details = await walletGetTransferDetails(
				state.manager,
				txid,
			)
			console.log(
				'[rpc] moneroGetTransferDetails complete:',
				details?.hash,
			)
			return details
		},
		moneroGetFeeEstimate: async () => {
			console.log('[rpc] moneroGetFeeEstimate')
			if (!state.manager)
				throw new Error('Monero wallet RPC not started')
			try {
				const fee = await walletGetFeeEstimate(state.manager)
				console.log('[monero][gas][fee]', fee)
				return fee
			} catch (error) {
				console.log('[monero][gas][error]', error)
				return null
			}
		},
	}
}
