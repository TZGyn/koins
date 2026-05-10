import {
	ApplicationMenu,
	BrowserView,
	BrowserWindow,
	Updater,
	defineElectrobunRPC,
	type RPCSchema,
} from 'electrobun/bun'

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

const ETHERSCAN_API = 'https://api.etherscan.io/v2/api'

type EtherscanTx = {
	blockNumber: string
	timeStamp: string
	hash: string
	from: string
	to: string
	value: string
	gas: string
	gasPrice: string
	isError: string
	txreceipt_status: string
	input: string
	contractAddress: string
	gasUsed: string
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
					page?: number
					offset?: number
				}
				response: Promise<EtherscanTx[]>
			}
		}
		messages: {}
	}>
	webview: RPCSchema<{
		requests: {}
		messages: {}
	}>
}
const rpc = BrowserView.defineRPC<RPC>({
	maxRequestTime: 10000,
	handlers: {
		requests: {
			getSecret: async ({ name, service }) => {
				return await Bun.secrets.get({ name, service })
			},
			setSecret: async ({ name, service, value }) => {
				await Bun.secrets.set({ name, service, value })
			},
			fetchTxHistory: async ({
				address,
				chainid,
				page = 1,
				offset = 20,
			}) => {
				const key = await Bun.secrets.get({
					service: 'koins',
					name: 'etherscan_key',
				})
				if (!key) return []
				const params = new URLSearchParams({
					module: 'account',
					action: 'txlist',
					address,
					page: String(page),
					offset: String(offset),
					sort: 'desc',
					apikey: key,
					chainid,
				})
				try {
					const url = `${ETHERSCAN_API}?${params}`
					const res = await fetch(url)
					const data = await res.json()
					console.log(data)
					if (data.status !== '1') return []
					return data.result as EtherscanTx[]
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
