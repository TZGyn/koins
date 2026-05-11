import { post } from './call'
import { getChainID, getURL } from './network'
import { inspect } from 'util'

export const getTokensBalances = async (
	key: string,
	chainid: string,
	address: string,
) => {
	const chainId = getChainID(chainid)
	if (!chainId) return

	const url = getURL({
		chainId,
		key,
	})

	const balRes = await post<{
		address: `0x${string}`
		tokenBalances: {
			contractAddress: `0x${string}`
			tokenBalance: string
		}[]
	}>(url, {
		jsonrpc: '2.0',
		id: 0,
		method: 'alchemy_getTokenBalances',
		params: [address, 'erc20'],
	})

	console.log(inspect(balRes, { depth: null, colors: true }))

	return balRes
}
