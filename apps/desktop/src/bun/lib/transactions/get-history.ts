import { eq, and, or, desc } from 'drizzle-orm'
import { db } from '../db'
import { txHistory } from '../db/schema'
import type { Transaction } from '../alchemy/types'

export const getTransactionHistory = async (
	key: string,
	chainid: string,
	address: string,
	opts: { maxCount: number },
) => {
	return getCachedTransactionHistory(chainid, address)
}

export const getCachedTransactionHistory = (
	chainid: string,
	address: string,
) => {
	const addrLower = address.toLowerCase()
	const rows = db
		.select()
		.from(txHistory)
		.where(
			and(
				eq(txHistory.chainId, chainid),
				or(
					eq(txHistory.from, addrLower),
					eq(txHistory.to, addrLower),
				),
			),
		)
		.orderBy(desc(txHistory.blockNum))
		.all()

	return rows.map(toTransfer)
}

function toTransfer(row: typeof txHistory.$inferSelect): Transaction {
	if (row.raw) {
		return JSON.parse(row.raw) as Transaction
	}
	return {
		hash: row.hash,
		blockNum: row.blockNum
			? `0x${parseInt(row.blockNum).toString(16)}`
			: undefined,
		from: row.from ?? undefined,
		to: row.to ?? undefined,
		value: row.value ? Number(row.value) : undefined,
		asset: row.asset ?? undefined,
		category: row.category as Transaction['category'],
		rawContract:
			row.rawContractAddress || row.rawContractDecimal
				? {
						address: row.rawContractAddress ?? undefined,
						decimal: row.rawContractDecimal ?? undefined,
					}
				: undefined,
		metadata: row.metadataBlockTimestamp
			? { blockTimestamp: row.metadataBlockTimestamp }
			: undefined,
	}
}
