export type Token = {}

export type TokenBalance = {}

export type Transaction = {
	category?:
		| 'external'
		| 'internal'
		| 'token'
		| 'erc20'
		| 'erc721'
		| 'erc1155'
		| 'specialnft'
	blockNum?: string
	from?: string
	to?: string
	value?: number
	erc721TokenId?: string
	erc1155Metadata?: {
		tokenId: string
		value: string
	}[]
	tokenId?: string
	asset?: string
	uniqueId?: string
	hash?: string
	rawContract?: {
		value?: string
		address?: string
		decimal?: string
	}
	metadata?: {
		blockTimestamp?: string
	}
}
