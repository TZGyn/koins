import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import { tokenMetadata } from '../db/schema'
import { post } from './call'
import { getChainID, getURL } from './network'

export const getTokenMetadata = async (
	key: string,
	chainid: string,
	tokenAddress: string,
) => {
	const chainId = getChainID(chainid)
	if (!chainId) return

	const cached = db
		.select()
		.from(tokenMetadata)
		.where(
			and(
				eq(tokenMetadata.chainId, chainId),
				eq(tokenMetadata.contractAddress, tokenAddress.toLowerCase()),
			),
		)
		.get()

	if (cached) {
		return {
			jsonrpc: '2.0' as const,
			id: 0,
			result: {
				name: cached.name ?? null,
				symbol: cached.symbol,
				decimals: cached.decimals ?? null,
				logo: cached.logo ?? null,
			},
		}
	}

	const url = getURL({
		chainId,
		key,
	})

	const result = await post<{
		name: string | null
		symbol: string | null
		decimals: number | null
		logo: string | null
	}>(url, {
		jsonrpc: '2.0',
		id: 0,
		method: 'alchemy_getTokenMetadata',
		params: [tokenAddress],
	})

	if (result?.result?.symbol) {
		try {
			await db
				.insert(tokenMetadata)
				.values({
					name: result.result.name,
					symbol: result.result.symbol,
					decimals: result.result.decimals,
					logo: result.result.logo,
					contractAddress: tokenAddress.toLowerCase(),
					chainId,
				})
				.onConflictDoNothing()
		} catch (e) {
			console.log('Failed to cache token metadata', e)
		}
	}

	return result
}
