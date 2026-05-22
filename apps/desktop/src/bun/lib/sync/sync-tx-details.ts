import { getClient, getTransactionDetails } from '../viem'
import { db } from '../db'
import { transactions, transactionReceipts } from '../db/schema'
import { getChainID } from '../alchemy/network'

export const syncTxDetails = async (
	chainId: string,
	apiKey: string,
	hash: string,
) => {
	const client = getClient(chainId, apiKey)

	const id = getChainID(chainId)
	if (!id) return null

	const raw = await getTransactionDetails(client, hash)
	if (!raw) return null

	const hashLower = hash.toLowerCase()

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
}
