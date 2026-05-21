import { post } from './call'
import { getChainID, getURL } from './network'
import type { Transaction } from './types'
import { numberToHex } from 'viem'

type PageResult = {
	transfers: Transaction[]
	pageKey?: string
}

async function fetchPage(
	url: string,
	fromAddr: string | undefined,
	toAddr: string | undefined,
	fromBlock: string | undefined,
	chainId: string,
): Promise<{ result?: PageResult }> {
	const category = ['external', 'erc20']
	if (chainId !== '56') {
		category.push('internal')
	}

	const body = {
		jsonrpc: '2.0',
		id: 0,
		method: 'alchemy_getAssetTransfers',
		params: [
			{
				...(fromAddr ? { fromAddress: fromAddr } : {}),
				...(toAddr ? { toAddress: toAddr } : {}),
				...(fromBlock ? { fromBlock } : {}),
				category,
				withMetadata: true,
				maxCount: numberToHex(1000),
				order: 'asc' as const,
			},
		],
	}

	return post<PageResult>(url, body)
}

export const getTransactionHistory = async (
	key: string,
	chainid: string,
	address: string,
	opts: { maxCount: number; fromBlock?: string },
) => {
	const chainId = getChainID(chainid)
	if (!chainId) return

	const url = getURL({ chainId, key })
	const seen = new Set<string>()
	const all: Transaction[] = []

	for (const direction of ['out', 'in'] as const) {
		const fromAddr = direction === 'out' ? address : undefined
		const toAddr = direction === 'in' ? address : undefined
		let cursorBlock = opts.fromBlock

		for (let page = 0; page < 100; page++) {
			const res = await fetchPage(url, fromAddr, toAddr, cursorBlock, chainId)
			const transfers = res.result?.transfers ?? []
			if (transfers.length === 0) break

			let pageMaxBlock = 0
			let firstTimestamp = ''
			let lastTimestamp = ''
			for (const t of transfers) {
				if (!t.hash) continue
				if (seen.has(t.hash)) continue
				seen.add(t.hash)
				all.push(t)

				if (t.blockNum) {
					const blockNum = parseInt(t.blockNum, 16)
					if (blockNum > pageMaxBlock) {
						pageMaxBlock = blockNum
					}
				}
				if (t.metadata?.blockTimestamp) {
					if (!firstTimestamp) firstTimestamp = t.metadata.blockTimestamp
					lastTimestamp = t.metadata.blockTimestamp
				}
			}

			console.log(
				`[alchemy] ${direction} page ${page + 1}: ${transfers.length} transfers, ` +
				`block ${pageMaxBlock}, ` +
				`${new Date(firstTimestamp).toISOString()} → ${new Date(lastTimestamp).toISOString()}`,
			)

			if (pageMaxBlock === 0) break
			cursorBlock = numberToHex(pageMaxBlock + 1)
		}
	}

	console.log(
		`[alchemy] total: ${all.length} transfers for ${chainid}/${address.slice(0, 10)}... ` +
		`from ${opts.fromBlock ?? 'genesis'}`,
	)
	return all
}
