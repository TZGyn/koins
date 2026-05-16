import { bsc, mainnet, polygon, type Chain } from 'viem/chains'
import type { ChainID } from '../alchemy/network'

const chains: Record<ChainID, Chain> = {
	'1': mainnet,
	'56': bsc,
	'137': polygon,
}

export const getChain = (id: ChainID) => {
	return chains[id]
}
