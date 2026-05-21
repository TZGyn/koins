import { int, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

export const tokenMetadata = sqliteTable(
	'token_metadata',
	{
		name: text(),
		symbol: text().notNull(),
		decimals: int(),
		logo: text(),
		contractAddress: text().notNull(),
		chainId: text().notNull(),
	},
	(table) => ({
		contractUnique: uniqueIndex('contract_unique').on(
			table.chainId,
			table.contractAddress,
		),
	}),
)

export const transactions = sqliteTable(
	'transactions',
	{
		hash: text().notNull(),
		chainId: text().notNull(),
		from: text().notNull(),
		to: text(),
		value: text().notNull(),
		blockNumber: text(),
		blockHash: text(),
		gas: text().notNull(),
		gasPrice: text(),
		maxFeePerGas: text(),
		maxPriorityFeePerGas: text(),
		input: text().notNull(),
		nonce: int().notNull(),
		transactionIndex: int(),
		type: text(),
		v: text(),
		r: text(),
		s: text(),
		yParity: int(),
	},
	(table) => ({
		txUnique: uniqueIndex('tx_unique').on(table.chainId, table.hash),
	}),
)

export const transactionReceipts = sqliteTable(
	'transaction_receipts',
	{
		transactionHash: text().notNull(),
		chainId: text().notNull(),
		blockHash: text().notNull(),
		blockNumber: text().notNull(),
		from: text().notNull(),
		to: text(),
		cumulativeGasUsed: text().notNull(),
		gasUsed: text().notNull(),
		status: text().notNull(),
		effectiveGasPrice: text(),
		contractAddress: text(),
		type: text().notNull(),
		transactionIndex: int().notNull(),
		logsBloom: text(),
	},
	(table) => ({
		receiptUnique: uniqueIndex('receipt_unique').on(
			table.chainId,
			table.transactionHash,
		),
	}),
)

export const evmWallets = sqliteTable('evm_wallets', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	passwordHash: text('password_hash'),
	vaultKey: text('vault_key').notNull(),
	createdAt: text('created_at').notNull(),
})

export const txSyncStatus = sqliteTable('tx_sync_status', {
	chainId: text('chain_id').notNull(),
	address: text('address').notNull(),
	lastSyncBlock: text('last_sync_block').notNull(),
	syncedAt: text('synced_at').notNull(),
}, (table) => ({
	syncUnique: uniqueIndex('sync_unique').on(table.chainId, table.address),
}))

export const txHistory = sqliteTable(
	'tx_history',
	{
		chainId: text().notNull(),
		hash: text().notNull(),
		blockNum: text(),
		from: text(),
		to: text(),
		value: text(),
		asset: text(),
		category: text(),
		rawContractAddress: text(),
		rawContractDecimal: text(),
		metadataBlockTimestamp: text(),
		raw: text().notNull(),
		syncedAt: text().notNull(),
	},
	(table) => ({
		historyUnique: uniqueIndex('tx_history_unique').on(table.chainId, table.hash, table.category, table.rawContractAddress),
		blockIdx: index('tx_history_block_idx').on(table.chainId, table.blockNum),
		fromIdx: index('tx_history_from_idx').on(table.from),
		toIdx: index('tx_history_to_idx').on(table.to),
	}),
)
