import { post } from './call'
import { getChainID, getURL } from './network'
import type { Transaction } from './types'
import { numberToHex } from 'viem'
import { inspect } from 'util'

export const getTransactionHistory = async (
	key: string,
	chainid: string,
	address: string,
	{ maxCount = 20 }: { maxCount: number },
) => {
	const chainId = getChainID(chainid)
	if (!chainId) return

	const url = getURL({
		chainId,
		key,
	})

	const category = ['external', 'erc20']

	if (chainId !== '56') {
		category.push('internal')
	}

	const body = (fromAddress?: string, toAddress?: string) => ({
		jsonrpc: '2.0',
		id: 0,
		method: 'alchemy_getAssetTransfers',
		params: [
			{
				...(fromAddress ? { fromAddress } : {}),
				...(toAddress ? { toAddress } : {}),
				category: category,
				withMetadata: true,
				maxCount: numberToHex(maxCount),
			},
		],
	})

	const outRequest = post<{
		transfers: Transaction[]
		pageKey: string
	}>(url, body(address, undefined))

	const inRequest = post<{
		transfers: Transaction[]
	}>(url, body(undefined, address))

	const outRes = await outRequest
	const inRes = await inRequest

	const outgoing = outRes.result?.transfers ?? []
	const incoming = inRes.result?.transfers ?? []

	const seen = new Set<string>()
	return [...outgoing, ...incoming].filter((t) => {
		if (!t.hash) return false
		if (seen.has(t.hash)) return false
		seen.add(t.hash)
		return true
	})
}
