import { eq, and } from 'drizzle-orm'
import { formatEther, formatGwei, type PublicClient } from 'viem'
import { db } from '../db'
import { transactions, transactionReceipts } from '../db/schema'
import { getChainID } from '../alchemy/network'
import { getTransactionDetails as fetchFromViem } from '../viem/get-transaction-details'

export const getTransactionDetails = async (
	client: PublicClient,
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

	const raw = await fetchFromViem(client, hash)
	if (!raw) return null

	try {
		await db
			.insert(transactions)
			.values({
				hash: hashLower,
				chainId: id,
				from: raw.tx.from.toLowerCase(),
				to: raw.tx.to?.toLowerCase() ?? null,
				value: raw.tx.value.toString(),
				blockNumber: raw.tx.blockNumber?.toString() ?? null,
				blockHash: raw.tx.blockHash?.toLowerCase() ?? null,
				gas: raw.tx.gas.toString(),
				gasPrice: raw.tx.gasPrice?.toString() ?? null,
				maxFeePerGas: raw.tx.maxFeePerGas?.toString() ?? null,
				maxPriorityFeePerGas:
					raw.tx.maxPriorityFeePerGas?.toString() ?? null,
				input: raw.tx.input,
				nonce: raw.tx.nonce,
				transactionIndex: raw.tx.transactionIndex ?? null,
				type: raw.tx.type ?? null,
				v: raw.tx.v?.toString() ?? null,
				r: raw.tx.r?.toLowerCase() ?? null,
				s: raw.tx.s?.toLowerCase() ?? null,
				yParity: raw.tx.yParity ?? null,
			})
			.onConflictDoNothing()
	} catch (e) {
		console.log('Failed to cache transaction', e)
	}

	try {
		await db
			.insert(transactionReceipts)
			.values({
				transactionHash: hashLower,
				chainId: id,
				blockHash: raw.receipt.blockHash.toLowerCase(),
				blockNumber: raw.receipt.blockNumber.toString(),
				from: raw.receipt.from.toLowerCase(),
				to: raw.receipt.to?.toLowerCase() ?? null,
				cumulativeGasUsed: raw.receipt.cumulativeGasUsed.toString(),
				gasUsed: raw.receipt.gasUsed.toString(),
				status: raw.receipt.status,
				effectiveGasPrice:
					raw.receipt.effectiveGasPrice?.toString() ?? null,
				contractAddress:
					raw.receipt.contractAddress?.toLowerCase() ?? null,
				type: raw.receipt.type,
				transactionIndex: raw.receipt.transactionIndex,
				logsBloom: raw.receipt.logsBloom?.toLowerCase() ?? null,
			})
			.onConflictDoNothing()
	} catch (e) {
		console.log('Failed to cache transaction receipt', e)
	}

	return {
		hash: raw.tx.hash,
		from: raw.tx.from,
		to: raw.tx.to,
		value: formatEther(raw.tx.value),
		blockNumber: raw.receipt.blockNumber?.toString() ?? null,
		fee: (
			parseFloat(formatGwei(raw.receipt.gasUsed)) *
			parseFloat(formatGwei(raw.tx.gasPrice || BigInt(0)))
		).toString(),
		gasPrice: formatGwei(raw.tx.gasPrice || BigInt(0)),
		status: raw.receipt.status === 'success' ? 'success' : 'reverted',
		type: raw.tx.type,
		nonce: raw.tx.nonce,
		input: raw.tx.input,
	}
}
