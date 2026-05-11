import {
	ApplicationMenu,
	BrowserView,
	BrowserWindow,
	Updater,
	defineElectrobunRPC,
	type RPCSchema,
	Utils,
} from 'electrobun/bun'
import { inspect } from 'util'
import { getTokenMetadata, getTokensBalances } from './lib/alchemy'
import { tryCatch } from '@koins/utils'

const DEV_SERVER_PORT = 5173
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`

async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel()
	if (channel === 'dev') {
		try {
			await fetch(DEV_SERVER_URL, { method: 'HEAD' })
			console.log(
				`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`,
			)
			return DEV_SERVER_URL
		} catch {
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			)
		}
	}
	return 'views://mainview/index.html'
}

ApplicationMenu.setApplicationMenu([
	{
		label: 'File',
		submenu: [{ role: 'quit' }],
	},
	{
		label: 'Edit',
		submenu: [
			{ role: 'undo' },
			{ role: 'redo' },
			{ type: 'divider' },
			{ role: 'cut' },
			{ role: 'copy' },
			{ role: 'paste' },
			{ role: 'delete' },
			{ type: 'divider' },
			{ role: 'selectAll' },
		],
	},
	{
		label: 'Window',
		submenu: [{ role: 'minimize' }, { role: 'zoom' }],
	},
])

const url = await getMainViewUrl()

const ALCHEMY_NETWORKS: Record<string, string> = {
	'1': 'eth-mainnet',
	'137': 'polygon-mainnet',
	'56': 'bnb-mainnet',
}

type TokenBalanceResult = {
	symbol: string
	balance: string
	contractAddress: string
	logo?: string
}

type TxEntry = {
	hash: string
	timeStamp: string
	from: string
	to: string
	value: string
	tokenSymbol?: string
	tokenDecimal?: string
	contractAddress?: string
	pairedValue?: string
	pairedSymbol?: string
	pairedDecimals?: string
}

type RPC = {
	bun: RPCSchema<{
		requests: {
			getSecret: {
				params: {
					service: string
					name: string
				}
				response: Promise<string | null>
			}
			setSecret: {
				params: {
					service: string
					name: string
					value: string
				}
				response: Promise<void>
			}
			fetchTxHistory: {
				params: {
					address: string
					chainid: string
				}
				response: Promise<TxEntry[]>
			}
			fetchTokenBalances: {
				params: {
					address: string
					chainid: string
				}
				response: Promise<TokenBalanceResult[]>
			}
			openExternal: {
				params: {
					url: string
				}
				response: Promise<void>
			}
		}
		messages: {}
	}>
	webview: RPCSchema<{
		requests: {}
		messages: {}
	}>
}

async function fetchAlchemyTransfers(
	key: string,
	chainid: string,
	address: string,
): Promise<any[]> {
	const network = ALCHEMY_NETWORKS[chainid]
	if (!network) return []
	const url = `https://${network}.g.alchemy.com/v2/${key}`

	const body = (fromAddress?: string, toAddress?: string) => ({
		jsonrpc: '2.0',
		id: 0,
		method: 'alchemy_getAssetTransfers',
		params: [
			{
				...(fromAddress ? { fromAddress } : {}),
				...(toAddress ? { toAddress } : {}),
				category: ['external', 'erc20'],
				withMetadata: true,
				maxCount: '0x3E8',
			},
		],
	})

	const [outRes, inRes] = await Promise.all([
		fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body(address, undefined)),
		}).then((r) => r.json()),
		fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body(undefined, address)),
		}).then((r) => r.json()),
	])

	const outgoing: any[] = outRes.result?.transfers ?? []
	const incoming: any[] = inRes.result?.transfers ?? []

	const seen = new Set<string>()
	return [...outgoing, ...incoming].filter((t) => {
		if (seen.has(t.hash)) return false
		seen.add(t.hash)
		return true
	})
}

function formatUnits(balance: string, decimals: number): string {
	const bal = BigInt(balance)
	if (bal === 0n) return '0'
	const divisor = 10n ** BigInt(decimals)
	const intPart = bal / divisor
	const fracPart = (bal % divisor)
		.toString()
		.padStart(decimals, '0')
		.replace(/0+$/, '')
	return fracPart ? `${intPart}.${fracPart}` : `${intPart}`
}

async function fetchAlchemyTokenBalances(
	key: string,
	chainid: string,
	address: string,
): Promise<TokenBalanceResult[]> {
	const [balRes, balResError] = await tryCatch(
		getTokensBalances(key, chainid, address),
	)

	if (balResError) {
		console.log('Get Tokens Balance', balResError)
		return []
	}

	if (!balRes) return []

	const tokens = balRes.result?.tokenBalances ?? []
	const nonZero = tokens.filter((t) => t.tokenBalance !== '0x0')

	const metas = await Promise.allSettled(
		nonZero.map((t) =>
			getTokenMetadata(key, chainid, t.contractAddress),
		),
	)
	if (!metas) return []

	return nonZero
		.map((t: any, i: number) => {
			const meta =
				metas[i].status === 'fulfilled' && metas[i].value
					? metas[i].value.result
					: null
			return {
				symbol: meta?.symbol ?? 'Unknown',
				decimals: meta?.decimals ?? 0,
				balance: formatUnits(t.tokenBalance, meta?.decimals ?? 18),
				contractAddress: t.contractAddress,
				logo: meta?.logo ?? undefined,
			}
		})
		.filter((t) => t.logo && t.decimals !== 0)
}

function mapTransfer(t: any): TxEntry {
	const isExternal = t.category === 'external'
	return {
		hash: t.hash,
		timeStamp: String(
			Math.floor(
				new Date(t.metadata.blockTimestamp).getTime() / 1000,
			),
		),
		from: t.from,
		to: t.to,
		value: String(t.value),
		...(isExternal
			? {}
			: {
					tokenSymbol: t.asset,
					tokenDecimal: t.rawContract?.decimal
						? String(parseInt(t.rawContract.decimal, 16))
						: undefined,
					contractAddress: t.rawContract?.address ?? undefined,
				}),
	}
}

const rpc = BrowserView.defineRPC<RPC>({
	maxRequestTime: 200000,
	handlers: {
		requests: {
			getSecret: async ({ name, service }) => {
				return await Bun.secrets.get({ name, service })
			},
			setSecret: async ({ name, service, value }) => {
				await Bun.secrets.set({ name, service, value })
			},
			openExternal: async ({ url }) => {
				Utils.openExternal(url)
			},
			fetchTxHistory: async ({ address, chainid }) => {
				const key = await Bun.secrets.get({
					service: 'koins',
					name: 'alchemy_key',
				})
				if (!key) return []

				const all = await fetchAlchemyTransfers(key, chainid, address)

				const addrLower = address.toLowerCase()
				const byHash = new Map<string, any[]>()
				for (const t of all) {
					const h = t.hash
					if (!byHash.has(h)) byHash.set(h, [])
					byHash.get(h)!.push(t)
				}

				const combined: TxEntry[] = []

				for (const [, group] of byHash) {
					const external = group.filter(
						(t: any) => t.category === 'external',
					)
					const tokens = group.filter(
						(t: any) => t.category === 'erc20',
					)

					const extOut = external.filter(
						(t: any) => t.from.toLowerCase() === addrLower,
					)
					const extIn = external.filter(
						(t: any) => t.to.toLowerCase() === addrLower,
					)
					const tokIn = tokens.filter(
						(t: any) => t.to.toLowerCase() === addrLower,
					)
					const tokOut = tokens.filter(
						(t: any) => t.from.toLowerCase() === addrLower,
					)

					if (extOut.length > 0 && tokIn.length > 0) {
						combined.push({
							...mapTransfer(extOut[0]),
							tokenSymbol: tokIn[0].asset,
							tokenDecimal: tokIn[0].rawContract?.decimal
								? String(parseInt(tokIn[0].rawContract.decimal, 16))
								: undefined,
							contractAddress:
								tokIn[0].rawContract?.address ?? undefined,
							pairedValue: String(tokIn[0].value),
							pairedSymbol: tokIn[0].asset,
							pairedDecimals: tokIn[0].rawContract?.decimal
								? String(parseInt(tokIn[0].rawContract.decimal, 16))
								: undefined,
						})
					} else if (extOut.length > 0) {
						combined.push(mapTransfer(extOut[0]))
					} else if (extIn.length > 0) {
						combined.push(mapTransfer(extIn[0]))
					} else if (tokOut.length > 0 && tokIn.length > 0) {
						combined.push({
							...mapTransfer(tokOut[0]),
							pairedValue: String(tokIn[0].value),
							pairedSymbol: tokIn[0].asset,
							pairedDecimals: tokIn[0].rawContract?.decimal
								? String(parseInt(tokIn[0].rawContract.decimal, 16))
								: undefined,
						})
					} else if (tokOut.length > 0) {
						combined.push(mapTransfer(tokOut[0]))
					} else if (tokIn.length > 0) {
						combined.push(mapTransfer(tokIn[0]))
					}
				}

				combined.sort(
					(a, b) => Number(b.timeStamp) - Number(a.timeStamp),
				)

				return combined
			},
			fetchTokenBalances: async ({ address, chainid }) => {
				const key = await Bun.secrets.get({
					service: 'koins',
					name: 'alchemy_key',
				})
				if (!key) return []
				try {
					const result = await fetchAlchemyTokenBalances(
						key,
						chainid,
						address,
					)
					return result
				} catch (error) {
					console.log(error)
					return []
				}
			},
		},
		messages: {},
	},
})

const win = new BrowserWindow({
	title: 'Koins',
	url,
	rpc,
	frame: {
		width: 900,
		height: 700,
		x: 200,
		y: 200,
	},
})

console.log('Svelte app started!')
