export const ALCHEMY_NETWORKS = {
	'1': 'eth-mainnet',
	'137': 'polygon-mainnet',
	'56': 'bnb-mainnet',
} as const

export type ChainID = keyof typeof ALCHEMY_NETWORKS

export const CHAIN_ID = Object.keys(
	ALCHEMY_NETWORKS,
) as Array<ChainID>

export const getChainID = (id: string) => {
	if (CHAIN_ID.includes(id as ChainID)) {
		return id as ChainID
	}
	return null
}

export const getURL = ({
	key,
	chainId,
}: {
	chainId: ChainID
	key: string
}) => {
	const network = ALCHEMY_NETWORKS[chainId]
	const url = `https://${network}.g.alchemy.com/v2/${key}`

	return url
}
