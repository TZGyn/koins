import { getTokenMetadata } from '../../lib/tokens'
import { getTokensBalances } from '../../lib/alchemy'
import { tryCatch } from '@koins/utils'
import {
	getTransactionHistory,
	getTransactionDetails,
	getCachedTransactionHistory,
} from '../../lib/transactions'
import { syncTransactionHistory } from '../../lib/sync'
import { eq, and } from 'drizzle-orm'
import { db } from '../../lib/db'
import { getClient } from '../../lib/viem'
import { formatGwei, parseEther, parseUnits, encodeFunctionData, createWalletClient } from 'viem'
import { mnemonicToAccount } from 'viem/accounts'
import { getChain } from '../../lib/viem/getChain'
import { getChainID } from '../../lib/alchemy/network'
import { alchemyTransport } from '@alchemy/common'
import { sqlite } from '../../lib/sqlite'
import { txHistory, evmWallets } from '../../lib/db/schema'
import type {
	TokenBalanceResult,
	TokenPriceEntry,
	TxEntry,
} from '../../../lib/rpc-schema'

export function createEvmHandlers(
	rpc: {
		send: {
			transfersUpdate: (p: {
				count: number
				chainid: string
				address: string
			}) => void
		}
	},
	syncState: {
		target: { address: string; chainid: string } | null
		timer: ReturnType<typeof setInterval> | null
	},
) {
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
		const nonZero = tokens.filter(
			(t: any) => t.tokenBalance !== '0x0',
		)
		const metas = await Promise.allSettled(
			nonZero.map((t: any) =>
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
					entry.logo = logoMap.get(
						entry.contractAddress.toLowerCase(),
					)
				if (entry.pairedContractAddress)
					entry.pairedLogo = logoMap.get(
						entry.pairedContractAddress.toLowerCase(),
					)
			}
		}

		combined.sort((a, b) => Number(b.timeStamp) - Number(a.timeStamp))
		return combined
	}

	return {
		fetchTxHistory: async ({
			address,
			chainid,
		}: {
			address: string
			chainid: string
		}) => {
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
		fetchCachedTxHistory: async ({
			address,
			chainid,
		}: {
			address: string
			chainid: string
		}) => {
			const transfers = await getCachedTransactionHistory(
				chainid,
				address,
			)
			return pairTransfers(transfers, address)
		},
		syncTxHistory: async ({
			address,
			chainid,
		}: {
			address: string
			chainid: string
		}) => {
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
		setAutoSync: async (
			target: { address: string; chainid: string } | null,
		) => {
			if (syncState.timer) clearInterval(syncState.timer)
			syncState.timer = null
			syncState.target = null
			if (!target) return
			syncState.target = target
			syncState.timer = setInterval(async () => {
				if (!syncState.target) return
				const key = await Bun.secrets.get({
					service: 'koins',
					name: 'alchemy_key',
				})
				if (!key) return
				try {
					const count = await syncTransactionHistory(
						key,
						syncState.target.chainid,
						syncState.target.address,
					)
					rpc.send.transfersUpdate({
						count,
						chainid: syncState.target.chainid,
						address: syncState.target.address,
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
		fetchTokenBalances: async ({
			address,
			chainid,
		}: {
			address: string
			chainid: string
		}) => {
			const key = await Bun.secrets.get({
				service: 'koins',
				name: 'alchemy_key',
			})
			if (!key) return []
			try {
				return await fetchAlchemyTokenBalances(key, chainid, address)
			} catch (error) {
				console.log(error)
				return []
			}
		},
		fetchTokenPrices: async ({
			symbols,
			addresses,
		}: {
			symbols?: string[]
			addresses?: { network: string; address: string }[]
		}) => {
			const key = await Bun.secrets.get({
				service: 'koins',
				name: 'alchemy_key',
			})
			if (!key) return []
			try {
				const results: TokenPriceEntry[] = []
				if (symbols && symbols.length > 0) {
					const url = `https://api.g.alchemy.com/prices/v1/${key}/tokens/by-symbol?${symbols.map((s) => `symbols=${encodeURIComponent(s)}`).join('&')}`
					const res = await fetch(url, {
						signal: AbortSignal.timeout(10000),
					})
					if (res.ok) {
						const body = await res.json()
						for (const d of body.data ?? []) {
							for (const p of d.prices ?? []) {
								results.push({
									symbol: d.symbol,
									currency: p.currency,
									value: p.value,
									lastUpdatedAt: p.lastUpdatedAt,
								})
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
						for (const d of body.data ?? []) {
							for (const p of d.prices ?? []) {
								results.push({
									symbol: d.symbol,
									currency: p.currency,
									value: p.value,
									lastUpdatedAt: p.lastUpdatedAt,
									network: d.network,
									address: d.address,
								})
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
		fetchGasPrice: async ({ chainid }: { chainid: string }) => {
			const key = await Bun.secrets.get({
				service: 'koins',
				name: 'alchemy_key',
			})
			if (!key) {
				console.log('[gas] no key')
				return null
			}
			try {
				const client = getClient(chainid, key)
				const gasPrice = await client.getGasPrice()
				console.log(
					'[gas] price for chain',
					chainid,
					':',
					gasPrice.toString(),
				)
				return formatGwei(gasPrice)
			} catch (error) {
				console.log('[gas] error:', error)
				return null
			}
		},
		fetchTransactionDetails: async ({
			hash,
			chainid,
			address,
		}: {
			hash: string
			chainid: string
			address?: string
		}) => {
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
		evmCreateWallet: async ({
			name,
			phrase,
			passwordHash,
		}: {
			name: string
			phrase: string
			passwordHash?: string
		}) => {
			console.log('[rpc] evmCreateWallet:', name)
			const id = crypto.randomUUID()
			const vaultKey = `evm_seed_${id}`
			await Bun.secrets.set({
				service: 'koins',
				name: vaultKey,
				value: phrase,
			})
			await db
				.insert(evmWallets)
				.values({
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
			return wallets.map((w: any) => ({
				id: w.id,
				name: w.name,
				hasPassword: !!w.passwordHash,
				vaultKey: w.vaultKey,
				createdAt: w.createdAt,
			}))
		},
		evmGetSeed: async ({ vaultKey }: { vaultKey: string }) => {
			console.log('[rpc] evmGetSeed:', vaultKey)
			const seed = await Bun.secrets.get({
				service: 'koins',
				name: vaultKey,
			})
			if (!seed) throw new Error('Seed not found in keychain')
			return seed
		},
		evmDeleteWallet: async ({ id }: { id: string }) => {
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
		evmSendTransfer: async ({
			seed,
			to,
			amount,
			chainid,
			contractAddress,
			tokenDecimals,
		}: {
			seed: string
			to: string
			amount: string
			chainid: string
			contractAddress?: string
			tokenDecimals?: number
		}) => {
			const key = await Bun.secrets.get({
				service: 'koins',
				name: 'alchemy_key',
			})
			if (!key) throw new Error('API key not set')
			const account = mnemonicToAccount(seed)
			const id = getChainID(chainid)
			if (!id) throw new Error('Unsupported chain')
			const chain = getChain(id)
			const walletClient = createWalletClient({
				account,
				chain,
				transport: alchemyTransport({ apiKey: key }),
			})
			if (contractAddress && tokenDecimals !== undefined) {
				const erc20Abi = [
					{
						name: 'transfer',
						type: 'function',
						inputs: [
							{ name: 'to', type: 'address' },
							{ name: 'amount', type: 'uint256' },
						],
						outputs: [{ name: '', type: 'bool' }],
					},
				] as const
				const data = encodeFunctionData({
					abi: erc20Abi,
					functionName: 'transfer',
					args: [to as `0x${string}`, parseUnits(amount, tokenDecimals)],
				})
				const hash = await walletClient.sendTransaction({
					to: contractAddress as `0x${string}`,
					data,
					value: 0n,
				})
				return hash
			}
			const hash = await walletClient.sendTransaction({
				to: to as `0x${string}`,
				value: parseEther(amount),
			})
			return hash
		},
	}
}
