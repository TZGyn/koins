import { int, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

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
