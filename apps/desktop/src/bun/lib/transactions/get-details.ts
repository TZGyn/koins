import { eq, and } from 'drizzle-orm'
import { formatEther, formatGwei, type PublicClient } from 'viem'
import { db } from '../db'
import { transactions, transactionReceipts } from '../db/schema'
import { getChainID } from '../alchemy/network'

export const getTransactionDetails = async (
	hash: string,
	chainId: string,
) => {
	if (!hash.startsWith('0x')) return null

	const id = getChainID(chainId)
	if (!id) return null

	const hashLower = hash.toLowerCase()

	const cachedTx = db
		.select()
		.from(transactions)
		.where(
			and(
				eq(transactions.hash, hashLower),
				eq(transactions.chainId, id),
			),
		)
		.get()

	const cachedReceipt = db
		.select()
		.from(transactionReceipts)
		.where(
			and(
				eq(transactionReceipts.transactionHash, hashLower),
				eq(transactionReceipts.chainId, id),
			),
		)
		.get()

	if (cachedTx && cachedReceipt) {
		const value = BigInt(cachedTx.value)
		const gasUsed = BigInt(cachedReceipt.gasUsed)
		const gasPrice = cachedTx.gasPrice
			? BigInt(cachedTx.gasPrice)
			: BigInt(0)

		return {
			hash: cachedTx.hash,
			from: cachedTx.from,
			to: cachedTx.to,
			value: formatEther(value),
			blockNumber: cachedReceipt.blockNumber,
			fee: (
				parseFloat(formatGwei(gasUsed)) *
				parseFloat(formatGwei(gasPrice))
			).toString(),
			gasPrice: formatGwei(gasPrice),
			status: cachedReceipt.status as 'success' | 'reverted',
			type: cachedTx.type ?? 'legacy',
			nonce: cachedTx.nonce,
			input: cachedTx.input,
		}
	}

	return null
}
