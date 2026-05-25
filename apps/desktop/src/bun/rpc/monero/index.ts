import {
	isBinaryInstalled,
	downloadBinary,
	MoneroWalletManager,
} from '../../lib/monero'

export function createMoneroHandlers(state: {
	manager: MoneroWalletManager | null
	downloading: boolean
}) {
	return {
		moneroBinaryStatus: async () => {
			const status = {
				installed: isBinaryInstalled(),
				downloading: state.downloading,
				error: undefined,
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
				state.manager = new MoneroWalletManager()
			}
			try {
				await state.manager.start(daemonAddress)
			} catch (e) {
				console.log('[rpc] moneroStart error:', e)
				return { running: false, walletOpen: false, connected: false }
			}
			const connected = await state.manager.isConnected()
			console.log('[rpc] moneroStart complete, connected:', connected)
			return { running: true, walletOpen: false, connected }
		},
		moneroStop: async () => {
			console.log('[rpc] moneroStop')
			if (state.manager) {
				await state.manager.stop()
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
			const result = await state.manager.createWallet(name, password)
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
			await state.manager.restoreWallet(
				name,
				password,
				mnemonic,
				restoreHeight,
			)
			const address = await state.manager.getAddress()
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
			await state.manager.openWallet(name, password)
		},
		moneroGetBalance: async () => {
			console.log('[rpc] moneroGetBalance')
			if (!state.manager)
				throw new Error('Monero wallet RPC not started')
			const { balance, unlocked } = await state.manager.getBalance()
			const address = await state.manager.getAddress()
			const height = await state.manager.getHeight()
			const daemonHeight = await state.manager.getDaemonHeight()
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
			const txs = await state.manager.getTransactions(accountIndex)
			console.log(`[rpc] moneroGetTransactions: ${txs.length} txs`)
			return txs
		},
		moneroWalletStatus: async () => {
			if (!state.manager) {
				console.log('[rpc] moneroWalletStatus: not running')
				return { running: false, walletOpen: false, connected: false }
			}
			const connected = await state.manager.isConnected()
			const walletOpen = await state.manager.isWalletOpen()
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
			const accounts = await state.manager.getAccounts()
			console.log(
				`[rpc] moneroGetAccounts: ${accounts.length} accounts`,
			)
			return accounts
		},
		moneroListWallets: async () => {
			console.log('[rpc] moneroListWallets')
			if (!state.manager)
				throw new Error('Monero wallet RPC not started')
			const wallets = state.manager.listWallets()
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
			const result = await state.manager.transfer(
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
			const details = await state.manager.getTransferDetails(txid)
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
				const fee = await state.manager.getFeeEstimate()
				console.log('[monero][gas][fee]', fee)
				return fee
			} catch (error) {
				console.log('[monero][gas][error]', error)
				return null
			}
		},
	}
}
