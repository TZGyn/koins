import { isHex, type PublicClient } from 'viem'

export const getTransactionDetails = async (
	client: PublicClient,
	hash: string,
) => {
	if (!isHex(hash)) return null

	const [tx, receipt] = await Promise.all([
		client.getTransaction({ hash }),
		client.getTransactionReceipt({ hash }),
	])

	return {
		tx: {
			hash: tx.hash,
			from: tx.from,
			to: tx.to ?? null,
			value: tx.value,
			blockNumber: tx.blockNumber ?? null,
			gasPrice: tx.gasPrice ?? null,
			gas: tx.gas,
			input: tx.input,
			nonce: tx.nonce,
			type: tx.type ?? 'legacy',
			blockHash: tx.blockHash ?? null,
			maxFeePerGas: tx.maxFeePerGas ?? null,
			maxPriorityFeePerGas: tx.maxPriorityFeePerGas ?? null,
			transactionIndex: tx.transactionIndex ?? null,
			v: tx.v ?? null,
			r: tx.r?.toString() ?? null,
			s: tx.s?.toString() ?? null,
			yParity: tx.yParity ?? null,
		},
		receipt: {
			blockHash: receipt.blockHash,
			blockNumber: receipt.blockNumber,
			from: receipt.from,
			to: receipt.to ?? null,
			cumulativeGasUsed: receipt.cumulativeGasUsed,
			gasUsed: receipt.gasUsed,
			status: receipt.status,
			effectiveGasPrice: receipt.effectiveGasPrice ?? null,
			contractAddress: receipt.contractAddress ?? null,
			type: receipt.type,
			transactionIndex: receipt.transactionIndex,
			logsBloom: receipt.logsBloom?.toString() ?? null,
		},
	}
}
