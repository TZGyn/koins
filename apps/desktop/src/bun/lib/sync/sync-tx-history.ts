import { eq, and } from 'drizzle-orm'
import { numberToHex } from 'viem'
import { db } from '../db'
import { txHistory, txSyncStatus } from '../db/schema'
import { getTransactionHistory } from '../alchemy/get-transaction-history'

const PAGE_SIZE = 76

export const syncTransactionHistory = async (
	key: string,
	chainid: string,
	address: string,
) => {
	const addrLower = address.toLowerCase()

	const existing = db
		.select()
		.from(txSyncStatus)
		.where(
			and(
				eq(txSyncStatus.chainId, chainid),
				eq(txSyncStatus.address, addrLower),
			),
		)
		.get()

	const fromBlock = existing?.lastSyncBlock
		? numberToHex(Number(existing.lastSyncBlock) + 1)
		: undefined

	const transfers = await getTransactionHistory(key, chainid, address, {
		maxCount: 1000,
		fromBlock,
	})

	if (!transfers || transfers.length === 0) return

	const prepared: Array<typeof txHistory.$inferInsert> = []
	let latestBlock = Number(existing?.lastSyncBlock ?? '0')

	for (const t of transfers) {
		if (!t.hash) continue
		if (t.blockNum) {
			const blockNum = parseInt(t.blockNum, 16)
			if (blockNum > latestBlock) latestBlock = blockNum
		}

		prepared.push({
			chainId: chainid,
			hash: t.hash,
			blockNum: t.blockNum ? String(parseInt(t.blockNum, 16)) : null,
			from: t.from?.toLowerCase() ?? null,
			to: t.to?.toLowerCase() ?? null,
			value: t.value?.toString() ?? null,
			asset: t.asset ?? null,
			category: t.category ?? null,
			rawContractAddress: t.rawContract?.address?.toLowerCase() ?? null,
			rawContractDecimal: t.rawContract?.decimal ?? null,
			metadataBlockTimestamp: t.metadata?.blockTimestamp ?? null,
			raw: JSON.stringify(t),
			syncedAt: new Date().toISOString(),
		})
	}

	flush(prepared)
	db.insert(txSyncStatus)
		.values({
			chainId: chainid,
			address: addrLower,
			lastSyncBlock: String(latestBlock),
			syncedAt: new Date().toISOString(),
		})
		.onConflictDoUpdate({
			target: [txSyncStatus.chainId, txSyncStatus.address],
			set: {
				lastSyncBlock: String(latestBlock),
				syncedAt: new Date().toISOString(),
			},
		})
		.run()

	console.log(
		`[sync] ${chainid}/${addrLower}: synced ${prepared.length} transfers up to block ${latestBlock}`,
	)
}

function flush(prepared: Array<typeof txHistory.$inferInsert>) {
	while (prepared.length > 0) {
		const batch = prepared.splice(0, PAGE_SIZE)
		const cols = ['chainId', 'hash', 'blockNum', '"from"', '"to"', 'value', 'asset', 'category', 'rawContractAddress', 'rawContractDecimal', 'metadataBlockTimestamp', 'raw', 'syncedAt']
		const colKeys = ['chainId', 'hash', 'blockNum', 'from', 'to', 'value', 'asset', 'category', 'rawContractAddress', 'rawContractDecimal', 'metadataBlockTimestamp', 'raw', 'syncedAt']
		const placeholders = batch.map(() => `(${colKeys.map(() => '?').join(',')})`).join(',')
		const flat = batch.flatMap((r) => colKeys.map((c) => (r as any)[c] ?? null))
		const sql = `INSERT OR IGNORE INTO tx_history (${cols.join(',')}) VALUES ${placeholders}`

		const dbClient = db.$client
		dbClient.exec('BEGIN')
		try {
			dbClient.run(sql, ...flat)
			dbClient.exec('COMMIT')
		} catch (e) {
			dbClient.exec('ROLLBACK')
			console.error('[sync] flush error:', e)
		}
	}
}
