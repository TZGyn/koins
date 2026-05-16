import { createPublicClient, http } from 'viem'
import { getChainID, getURL } from '../alchemy/network'
import { getChain } from './getChain'

export const getClient = (chainId: string, apiKey: string) => {
	const id = getChainID(chainId)

	if (!id) {
		throw new Error()
	}

	const url = getURL({ chainId: id, key: apiKey })
	const publicClient = createPublicClient({
		chain: getChain(id),
		transport: http(url),
	})

	return publicClient
}
