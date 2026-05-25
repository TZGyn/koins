import {
	ApplicationMenu,
	BrowserView,
	BrowserWindow,
	PATHS,
	Updater,
	Utils,
} from 'electrobun/bun'
import { getTokenMetadata } from './lib/tokens'
import { getTokensBalances, type Transaction } from './lib/alchemy'
import { tryCatch } from '@koins/utils'
import {
	getTransactionHistory,
	getTransactionDetails,
	getCachedTransactionHistory,
} from './lib/transactions'
import { syncTransactionHistory } from './lib/sync'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { eq, and } from 'drizzle-orm'
import { db } from './lib/db'
import { join } from 'path'
import { getENV } from './lib/get-env'
import { getClient } from './lib/viem'
import {
	isBinaryInstalled,
	downloadBinary,
	getBinaryPath,
	getBinaryDir,
	MoneroWalletManager,
} from './lib/monero'
import { canPromptTouchID, promptTouchID } from './lib/biometric'
import { sqlite } from './lib/sqlite'
import {
	tokenMetadata,
	transactions,
	transactionReceipts,
	txHistory,
	evmWallets,
} from './lib/db/schema'
import { syncTxDetails } from './lib/sync/sync-tx-details'
import type {
	RPC,
	TokenBalanceResult,
	TokenPriceEntry,
	TxEntry,
} from '../lib/rpc-schema'

const env = getENV()

console.log(env)

if (env.env === 'prod') {
	migrate(db, {
		migrationsFolder: join(PATHS.RESOURCES_FOLDER, 'app', 'drizzle'),
	})
}

const DEV_SERVER_PORT = 5173
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`

async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel()
	if (channel === 'dev') {
		try {
			await fetch(DEV_SERVER_URL, { method: 'HEAD' })
			console.log(
				`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`,
			)
			return DEV_SERVER_URL
		} catch {
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			)
		}
	}
	return 'views://mainview/index.html'
}

ApplicationMenu.setApplicationMenu([
	{
		label: 'File',
		submenu: [{ role: 'quit' }],
	},
	{
		label: 'Edit',
		submenu: [
			{ role: 'undo' },
			{ role: 'redo' },
			{ type: 'divider' },
			{ role: 'cut' },
			{ role: 'copy' },
			{ role: 'paste' },
			{ role: 'delete' },
			{ type: 'divider' },
			{ role: 'selectAll' },
		],
	},
	{
		label: 'Window',
		submenu: [{ role: 'minimize' }, { role: 'zoom' }],
	},
])

const url = await getMainViewUrl()

const ALCHEMY_NETWORKS: Record<string, string> = {
	'1': 'eth-mainnet',
	'137': 'polygon-mainnet',
	'56': 'bnb-mainnet',
}

const NATIVE_SYMBOLS: Record<string, string> = {
	'1': 'ETH',
	'137': 'POL',
	'56': 'BNB',
}

async function fetchAlchemyTransfers(
	key: string,
	chainid: string,
	address: string,
) {
	const transactions = await getTransactionHistory(
		key,
		chainid,
		address,
		{ maxCount: 10 },
	)

	if (!transactions) return []

	return transactions
}

function formatUnits(balance: string, decimals: number): string {
	const bal = BigInt(balance)
	if (bal === 0n) return '0'
	const divisor = 10n ** BigInt(decimals)
	const intPart = bal / divisor
	const fracPart = (bal % divisor)
		.toString()
		.padStart(decimals, '0')
		.replace(/0+$/, '')
	return fracPart ? `${intPart}.${fracPart}` : `${intPart}`
}

async function fetchAlchemyTokenBalances(
	key: string,
	chainid: string,
	address: string,
): Promise<TokenBalanceResult[]> {
	const [balRes, balResError] = await tryCatch(
		getTokensBalances(key, chainid, address),
	)

	if (balResError) {
		console.log('Get Tokens Balance Error', balResError)
		return []
	}

	if (!balRes) return []

	const tokens = balRes.result?.tokenBalances ?? []
	const nonZero = tokens.filter((t) => t.tokenBalance !== '0x0')

	const metas = await Promise.allSettled(
		nonZero.map((t) =>
			getTokenMetadata(key, chainid, t.contractAddress),
		),
	)
	if (!metas) return []

	return nonZero
		.map((t: any, i: number) => {
			const meta =
				metas[i].status === 'fulfilled' && metas[i].value
					? metas[i].value.result
					: null
			return {
				symbol: meta?.symbol ?? 'Unknown',
				decimals: meta?.decimals ?? 0,
				balance: formatUnits(t.tokenBalance, meta?.decimals ?? 18),
				contractAddress: t.contractAddress,
				logo: meta?.logo ?? undefined,
			}
		})
		.filter((t) => t.logo && t.decimals !== 0)
}

function mapTransfer(t: any): TxEntry {
	const isExternal = t.category === 'external'
	return {
		hash: t.hash,
		timeStamp: String(
			Math.floor(
				new Date(t.metadata?.blockTimestamp).getTime() / 1000,
			),
		),
		from: t.from,
		to: t.to,
		value: String(t.value),
		...(isExternal
			? {}
			: {
					tokenSymbol: t.asset,
					tokenDecimal: t.rawContract?.decimal
						? String(parseInt(t.rawContract.decimal, 16))
						: undefined,
					contractAddress: t.rawContract?.address ?? undefined,
				}),
	}
}

async function pairTransfers(
	transfers: any[],
	address: string,
	key?: string,
	chainid?: string,
): Promise<TxEntry[]> {
	const addrLower = address.toLowerCase()
	const byHash = new Map<string, any[]>()
	for (const t of transfers) {
		if (!t.hash) continue
		const h = t.hash
		if (!byHash.has(h)) byHash.set(h, [])
		byHash.get(h)!.push(t)
	}

	const combined: TxEntry[] = []

	for (const [, group] of byHash) {
		const native = group.filter(
			(t: any) =>
				t.category === 'external' || t.category === 'internal',
		)
		const tokens = group.filter((t: any) => t.category === 'erc20')

		const extOut = native.filter(
			(t: any) => t.from?.toLowerCase() === addrLower,
		)
		const extIn = native.filter(
			(t: any) => t.to?.toLowerCase() === addrLower,
		)
		const tokIn = tokens.filter(
			(t: any) => t.to?.toLowerCase() === addrLower,
		)
		const tokOut = tokens.filter(
			(t: any) => t.from?.toLowerCase() === addrLower,
		)

		if (extOut.length > 0 && tokIn.length > 0) {
			combined.push({
				...mapTransfer(extOut[0]),
				tokenSymbol: tokIn[0].asset,
				tokenDecimal: tokIn[0].rawContract?.decimal
					? String(parseInt(tokIn[0].rawContract.decimal, 16))
					: undefined,
				contractAddress: tokIn[0].rawContract?.address ?? undefined,
				pairedValue: String(tokIn[0].value),
				pairedSymbol: tokIn[0].asset,
				pairedDecimals: tokIn[0].rawContract?.decimal
					? String(parseInt(tokIn[0].rawContract.decimal, 16))
					: undefined,
				pairedContractAddress:
					tokIn[0].rawContract?.address ?? undefined,
			})
		} else if (extOut.length > 0) {
			combined.push(mapTransfer(extOut[0]))
		} else if (extIn.length > 0) {
			combined.push(mapTransfer(extIn[0]))
		} else if (tokOut.length > 0 && tokIn.length > 0) {
			combined.push({
				...mapTransfer(tokOut[0]),
				pairedValue: String(tokIn[0].value),
				pairedSymbol: tokIn[0].asset,
				pairedDecimals: tokIn[0].rawContract?.decimal
					? String(parseInt(tokIn[0].rawContract.decimal, 16))
					: undefined,
				pairedContractAddress:
					tokIn[0].rawContract?.address ?? undefined,
			})
		} else if (tokOut.length > 0 && extIn.length > 0) {
			combined.push({
				...mapTransfer(tokOut[0]),
				pairedValue: String(extIn[0].value),
				pairedSymbol: chainid ? NATIVE_SYMBOLS[chainid] : undefined,
			})
		} else if (tokOut.length > 0) {
			combined.push(mapTransfer(tokOut[0]))
		} else if (tokIn.length > 0) {
			combined.push(mapTransfer(tokIn[0]))
		}
	}

	if (key && chainid) {
		const addrSet = new Set<string>()
		for (const entry of combined) {
			if (entry.contractAddress)
				addrSet.add(entry.contractAddress.toLowerCase())
			if (entry.pairedContractAddress)
				addrSet.add(entry.pairedContractAddress.toLowerCase())
		}
		const logoMap = new Map<string, string>()
		await Promise.all(
			Array.from(addrSet).map(async (addr) => {
				const meta = await getTokenMetadata(key, chainid, addr)
				if (meta?.result?.logo) logoMap.set(addr, meta.result.logo)
			}),
		)
		for (const entry of combined) {
			if (entry.contractAddress)
				entry.logo = logoMap.get(entry.contractAddress.toLowerCase())
			if (entry.pairedContractAddress)
				entry.pairedLogo = logoMap.get(
					entry.pairedContractAddress.toLowerCase(),
				)
		}
	}

	combined.sort((a, b) => Number(b.timeStamp) - Number(a.timeStamp))

	return combined
}

let moneroManager: MoneroWalletManager | null = null
let moneroDownloading = false

let autoSyncTarget: { address: string; chainid: string } | null = null
let autoSyncTimer: ReturnType<typeof setInterval> | null = null

const rpc = BrowserView.defineRPC<RPC>({
	maxRequestTime: 120000,
	handlers: {
		requests: {
			resetApp: async () => {
				try {
					const wallets = db.select().from(evmWallets).all()
					await Promise.all([
						Bun.secrets.delete({
							service: 'koins',
							name: 'alchemy_key',
						}),
						...wallets.flatMap((w) => [
							Bun.secrets.delete({
								service: 'koins',
								name: w.vaultKey,
							}),
							Bun.secrets.delete({
								service: 'koins',
								name: `evm_auth_${w.id}`,
							}),
						]),
					])
					sqlite.run('DELETE FROM token_metadata')
					sqlite.run('DELETE FROM transactions')
					sqlite.run('DELETE FROM transaction_receipts')
					sqlite.run('DELETE FROM tx_history')
					sqlite.run('DELETE FROM evm_wallets')
					console.log('[rpc] resetApp complete')
					return true
				} catch (e) {
					console.log('[rpc] resetApp error:', e)
					return false
				}
			},
			biometricCanAuth: async () => {
				console.log('[biometric] checking biometric...')
				try {
					const canPrompt = canPromptTouchID()
					console.log('[biometric] biometric ===', canPrompt)
					return canPrompt
				} catch {
					return false
				}
			},
			biometricAuth: async ({ reason }) => {
				try {
					return promptTouchID(reason)
				} catch {
					return false
				}
			},
			getSecret: async ({ name, service }) => {
				return await Bun.secrets.get({ name, service })
			},
			setSecret: async ({ name, service, value }) => {
				await Bun.secrets.set({ name, service, value })
			},
			openExternal: async ({ url }) => {
				Utils.openExternal(url)
			},
			generateQrCode: async ({ text, size }) => {
				const { default: QRCode } = await import('qrcode')
				return QRCode.toString(text, {
					type: 'svg',
					width: size ?? 128,
					margin: 1,
				})
			},
			fetchTxHistory: async ({ address, chainid }) => {
				const key = await Bun.secrets.get({
					service: 'koins',
					name: 'alchemy_key',
				})
				if (!key) return []

				const [all, allError] = await tryCatch(
					fetchAlchemyTransfers(key, chainid, address),
				)

				if (allError) {
					console.log(allError)
					return []
				}

				return pairTransfers(all, address, key, chainid)
			},
			fetchCachedTxHistory: async ({ address, chainid }) => {
				const transfers = await getCachedTransactionHistory(
					chainid,
					address,
				)
				return pairTransfers(transfers, address)
			},
			syncTxHistory: async ({ address, chainid }) => {
				const key = await Bun.secrets.get({
					service: 'koins',
					name: 'alchemy_key',
				})
				if (!key) return
				try {
					const count = await syncTransactionHistory(
						key,
						chainid,
						address,
					)
					rpc.send.transfersUpdate({ count, chainid, address })
				} catch (e) {
					console.error('[sync] error:', e)
				}
			},
			setAutoSync: async (target) => {
				if (autoSyncTimer) clearInterval(autoSyncTimer)
				autoSyncTimer = null
				autoSyncTarget = null
				if (!target) return
				autoSyncTarget = target
				autoSyncTimer = setInterval(async () => {
					if (!autoSyncTarget) return
					const key = await Bun.secrets.get({
						service: 'koins',
						name: 'alchemy_key',
					})
					if (!key) return
					try {
						const count = await syncTransactionHistory(
							key,
							autoSyncTarget.chainid,
							autoSyncTarget.address,
						)
						rpc.send.transfersUpdate({
							count,
							chainid: autoSyncTarget.chainid,
							address: autoSyncTarget.address,
						})
					} catch (e) {
						console.error('[auto-sync] error:', e)
					}
				}, 30000)
			},
			flushTxCache: async () => {
				sqlite.run('DELETE FROM tx_history')
				sqlite.run('DELETE FROM tx_sync_status')
				console.log('[rpc] flushTxCache complete')
			},
			fetchTokenBalances: async ({ address, chainid }) => {
				const key = await Bun.secrets.get({
					service: 'koins',
					name: 'alchemy_key',
				})
				if (!key) return []
				try {
					const result = await fetchAlchemyTokenBalances(
						key,
						chainid,
						address,
					)
					return result
				} catch (error) {
					console.log(error)
					return []
				}
			},
			fetchTokenPrices: async ({ symbols, addresses }) => {
				const key = await Bun.secrets.get({
					service: 'koins',
					name: 'alchemy_key',
				})
				if (!key) return []
				try {
					const results: TokenPriceEntry[] = []

					if (symbols && symbols.length > 0) {
						const url = `https://api.g.alchemy.com/prices/v1/${key}/tokens/by-symbol?${symbols.map((s) => `symbols=${encodeURIComponent(s)}`).join('&')}`
						const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
						if (res.ok) {
							const body = await res.json()
							const data = (body.data ?? []) as any[]
							for (const d of data) {
								for (const p of d.prices ?? []) {
									results.push({ symbol: d.symbol, currency: p.currency, value: p.value, lastUpdatedAt: p.lastUpdatedAt })
								}
							}
						}
					}

					if (addresses && addresses.length > 0) {
						const url = `https://api.g.alchemy.com/prices/v1/${key}/tokens/by-address`
						const res = await fetch(url, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ addresses }),
							signal: AbortSignal.timeout(10000),
						})
						if (res.ok) {
							const body = await res.json()
							const data = (body.data ?? []) as any[]
							for (const d of data) {
								for (const p of d.prices ?? []) {
									results.push({ symbol: d.symbol, currency: p.currency, value: p.value, lastUpdatedAt: p.lastUpdatedAt, network: d.network, address: d.address })
								}
							}
						}
					}

					console.log('[prices] results:', results.length)
					return results
				} catch (error) {
					console.log('[prices] error:', error)
					return []
				}
			},
			fetchTransactionDetails: async ({ hash, chainid, address }) => {
				const key = await Bun.secrets.get({
					service: 'koins',
					name: 'alchemy_key',
				})
				if (!key) return null
				try {
					const details = await getTransactionDetails(hash, chainid)
					if (!details) return null

					if (address) {
						const transfers = db
							.select()
							.from(txHistory)
							.where(
								and(
									eq(txHistory.chainId, chainid),
									eq(txHistory.hash, hash.toLowerCase()),
								),
							)
							.all()

						if (transfers.length > 0) {
							const paired = await pairTransfers(transfers, address)
							if (paired.length > 0 && paired[0].pairedValue) {
								details.pairedValue = paired[0].pairedValue
								details.pairedSymbol = paired[0].pairedSymbol
								details.pairedDecimals = paired[0].pairedDecimals
								details.pairedContractAddress =
									paired[0].pairedContractAddress
								details.pairedLogo = paired[0].pairedLogo
							}
						}
					}

					return details
				} catch (error) {
					console.log(error)
					return null
				}
			},
			moneroBinaryStatus: async () => {
				const status = {
					installed: isBinaryInstalled(),
					downloading: moneroDownloading,
				}
				console.log('[rpc] moneroBinaryStatus:', status)
				return status
			},
			moneroDownloadBinary: async () => {
				console.log(
					'[rpc] moneroDownloadBinary: starting download...',
				)
				moneroDownloading = true
				try {
					await downloadBinary()
					console.log('[rpc] moneroDownloadBinary: complete')
				} catch (e) {
					console.log('[rpc] moneroDownloadBinary failed:', e)
					throw e
				} finally {
					moneroDownloading = false
				}
			},
			moneroStart: async ({ daemonAddress }) => {
				console.log('[rpc] moneroStart:', { daemonAddress })
				if (!moneroManager) {
					moneroManager = new MoneroWalletManager()
				}
				try {
					await moneroManager.start(daemonAddress)
				} catch (e) {
					console.log('[rpc] moneroStart error:', e)
					return {
						running: false,
						walletOpen: false,
						connected: false,
					}
				}
				const connected = await moneroManager.isConnected()
				console.log(
					'[rpc] moneroStart complete, connected:',
					connected,
				)
				return { running: true, walletOpen: false, connected }
			},
			moneroStop: async () => {
				console.log('[rpc] moneroStop')
				if (moneroManager) {
					await moneroManager.stop()
					moneroManager = null
				}
			},
			moneroCreateWallet: async ({ name, password }) => {
				console.log('[rpc] moneroCreateWallet:', name)
				if (!moneroManager)
					throw new Error('Monero wallet RPC not started')
				const result = await moneroManager.createWallet(
					name,
					password,
				)
				console.log('[rpc] moneroCreateWallet complete')
				return result
			},
			moneroRestoreWallet: async ({
				name,
				password,
				mnemonic,
				restoreHeight,
			}) => {
				console.log('[rpc] moneroRestoreWallet:', name)
				if (!moneroManager)
					throw new Error('Monero wallet RPC not started')
				await moneroManager.restoreWallet(
					name,
					password,
					mnemonic,
					restoreHeight,
				)
				const address = await moneroManager.getAddress()
				console.log(
					'[rpc] moneroRestoreWallet complete, address:',
					address,
				)
				return { address }
			},
			moneroOpenWallet: async ({ name, password }) => {
				console.log('[rpc] moneroOpenWallet:', name)
				if (!moneroManager)
					throw new Error('Monero wallet RPC not started')
				await moneroManager.openWallet(name, password)
			},
			moneroGetBalance: async () => {
				console.log('[rpc] moneroGetBalance')
				if (!moneroManager)
					throw new Error('Monero wallet RPC not started')
				const { balance, unlocked } = await moneroManager.getBalance()
				const address = await moneroManager.getAddress()
				const height = await moneroManager.getHeight()
				const daemonHeight = await moneroManager.getDaemonHeight()
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
			moneroGetTransactions: async ({ accountIndex }) => {
				console.log('[rpc] moneroGetTransactions', { accountIndex })
				if (!moneroManager)
					throw new Error('Monero wallet RPC not started')
				const txs = await moneroManager.getTransactions(accountIndex)
				console.log(`[rpc] moneroGetTransactions: ${txs.length} txs`)
				return txs
			},
			moneroWalletStatus: async () => {
				if (!moneroManager) {
					console.log('[rpc] moneroWalletStatus: not running')
					return {
						running: false,
						walletOpen: false,
						connected: false,
					}
				}
				const connected = await moneroManager.isConnected()
				const walletOpen = await moneroManager.isWalletOpen()
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
				if (!moneroManager)
					throw new Error('Monero wallet RPC not started')
				const accounts = await moneroManager.getAccounts()
				console.log(
					`[rpc] moneroGetAccounts: ${accounts.length} accounts`,
				)
				return accounts
			},
			moneroListWallets: async () => {
				console.log('[rpc] moneroListWallets')
				if (!moneroManager)
					throw new Error('Monero wallet RPC not started')
				const wallets = moneroManager.listWallets()
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
			}) => {
				console.log('[rpc] moneroTransfer:', {
					address,
					amount,
					priority,
				})
				if (!moneroManager)
					throw new Error('Monero wallet RPC not started')
				const result = await moneroManager.transfer(
					address,
					BigInt(amount),
					priority ?? 0,
					accountIndex ?? 0,
				)
				console.log('[rpc] moneroTransfer complete:', result.txHash)
				return result
			},
			moneroGetTransferDetails: async ({ txid }) => {
				console.log('[rpc] moneroGetTransferDetails:', txid)
				if (!moneroManager)
					throw new Error('Monero wallet RPC not started')
				const details = await moneroManager.getTransferDetails(txid)
				console.log(
					'[rpc] moneroGetTransferDetails complete:',
					details?.hash,
				)
				return details
			},
			evmCreateWallet: async ({ name, phrase, passwordHash }) => {
				console.log('[rpc] evmCreateWallet:', name)
				const id = crypto.randomUUID()
				const vaultKey = `evm_seed_${id}`
				await Bun.secrets.set({
					service: 'koins',
					name: vaultKey,
					value: phrase,
				})
				await db.insert(evmWallets).values({
					id,
					name,
					passwordHash: passwordHash ?? null,
					vaultKey,
					createdAt: new Date().toISOString(),
				})
				console.log('[rpc] evmCreateWallet complete:', id)
				return { id, name, createdAt: new Date().toISOString() }
			},
			evmListWallets: async () => {
				console.log('[rpc] evmListWallets')
				const wallets = db.select().from(evmWallets).all()
				return wallets.map((w) => ({
					id: w.id,
					name: w.name,
					hasPassword: !!w.passwordHash,
					vaultKey: w.vaultKey,
					createdAt: w.createdAt,
				}))
			},
			evmGetSeed: async ({ vaultKey }) => {
				console.log('[rpc] evmGetSeed:', vaultKey)
				const seed = await Bun.secrets.get({
					service: 'koins',
					name: vaultKey,
				})
				if (!seed) throw new Error('Seed not found in keychain')
				return seed
			},
			evmDeleteWallet: async ({ id }) => {
				console.log('[rpc] evmDeleteWallet:', id)
				const wallet = db
					.select()
					.from(evmWallets)
					.where(eq(evmWallets.id, id))
					.get()
				if (!wallet) throw new Error('Wallet not found')
				await Promise.all([
					Bun.secrets.delete({
						service: 'koins',
						name: wallet.vaultKey,
					}),
					Bun.secrets.delete({
						service: 'koins',
						name: `evm_auth_${id}`,
					}),
				])
				db.delete(evmWallets).where(eq(evmWallets.id, id)).run()
				console.log('[rpc] evmDeleteWallet complete')
			},
		},
		messages: {},
	},
})

const win = new BrowserWindow({
	title: 'Koins',
	url,
	rpc,
	frame: {
		width: 900,
		height: 700,
		x: 200,
		y: 200,
	},
})

console.log('Koins app started!')
