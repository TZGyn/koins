import { post } from './call'
import { getChainID, getURL } from './network'

export const getTokenMetadata = async (
	key: string,
	chainid: string,
	tokenAddress: string,
) => {
	const chainId = getChainID(chainid)
	if (!chainId) return

	const url = getURL({
		chainId,
		key,
	})

	const result = await post<{
		name: string | null
		symbol: string | null
		decimals: number | null
		logo: string | null
	}>(url, {
		jsonrpc: '2.0',
		id: 0,
		method: 'alchemy_getTokenMetadata',
		params: [tokenAddress],
	})

	return result
}
