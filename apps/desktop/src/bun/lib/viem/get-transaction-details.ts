import {
	isHex,
	formatEther,
	type PublicClient,
	formatGwei,
	decodeFunctionData,
} from 'viem'

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
): Promise<TransactionDetails | null> => {
	if (!isHex(hash)) return null

	const [tx, receipt] = await Promise.all([
		client.getTransaction({ hash }),
		client.getTransactionReceipt({ hash }),
	])

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
