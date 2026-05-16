import { eq, and } from 'drizzle-orm'
import {
	isHex,
	formatEther,
	type PublicClient,
	formatGwei,
} from 'viem'
import { db } from '../db'
import { transactions, transactionReceipts } from '../db/schema'
import { getChainID } from '../alchemy/network'

export type TransactionDetails = {
	hash: string
	from: string
	to: string | null
	value: string
	blockNumber: string | null
	fee: string
	gasPrice: string
	status: 'success' | 'reverted'
	type: string
	nonce: number
	input: string
}

export const getTransactionDetails = async (
	client: PublicClient,
	hash: string,
	chainId: string,
): Promise<TransactionDetails | null> => {
	if (!isHex(hash)) return null

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

	const [tx, receipt] = await Promise.all([
		client.getTransaction({ hash }),
		client.getTransactionReceipt({ hash }),
	])

	try {
		await db
			.insert(transactions)
			.values({
				hash: hashLower,
				chainId: id,
				from: tx.from.toLowerCase(),
				to: tx.to?.toLowerCase() ?? null,
				value: tx.value.toString(),
				blockNumber: tx.blockNumber?.toString() ?? null,
				blockHash: tx.blockHash?.toLowerCase() ?? null,
				gas: tx.gas.toString(),
				gasPrice: tx.gasPrice?.toString() ?? null,
				maxFeePerGas: tx.maxFeePerGas?.toString() ?? null,
				maxPriorityFeePerGas:
					tx.maxPriorityFeePerGas?.toString() ?? null,
				input: tx.input,
				nonce: tx.nonce,
				transactionIndex: tx.transactionIndex ?? null,
				type: tx.type ?? null,
				v: tx.v?.toString() ?? null,
				r: tx.r?.toLowerCase() ?? null,
				s: tx.s?.toLowerCase() ?? null,
				yParity: tx.yParity ?? null,
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
				blockHash: receipt.blockHash.toLowerCase(),
				blockNumber: receipt.blockNumber.toString(),
				from: receipt.from.toLowerCase(),
				to: receipt.to?.toLowerCase() ?? null,
				cumulativeGasUsed: receipt.cumulativeGasUsed.toString(),
				gasUsed: receipt.gasUsed.toString(),
				status: receipt.status,
				effectiveGasPrice:
					receipt.effectiveGasPrice?.toString() ?? null,
				contractAddress:
					receipt.contractAddress?.toLowerCase() ?? null,
				type: receipt.type,
				transactionIndex: receipt.transactionIndex,
				logsBloom: receipt.logsBloom?.toLowerCase() ?? null,
			})
			.onConflictDoNothing()
	} catch (e) {
		console.log('Failed to cache transaction receipt', e)
	}

	return {
		hash: tx.hash,
		from: tx.from,
		to: tx.to,
		value: formatEther(tx.value),
		blockNumber: receipt.blockNumber?.toString() ?? null,
		fee: (
			parseFloat(formatGwei(receipt.gasUsed)) *
			parseFloat(formatGwei(tx.gasPrice || BigInt(0)))
		).toString(),
		gasPrice: formatGwei(tx.gasPrice || BigInt(0)),
		status: receipt.status === 'success' ? 'success' : 'reverted',
		type: tx.type,
		nonce: tx.nonce,
		input: tx.input,
	}
}
