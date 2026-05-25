import {
	ApplicationMenu,
	BrowserView,
	BrowserWindow,
	PATHS,
	Updater,
	Utils,
} from 'electrobun/bun'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { db } from './lib/db'
import { join } from 'path'
import { getENV } from './lib/get-env'
import { createEvmHandlers } from './rpc/evm'
import { createMoneroHandlers } from './rpc/monero'
import type { MoneroWalletState } from './lib/monero'
import { canPromptTouchID, promptTouchID } from './lib/biometric'
import { sqlite } from './lib/sqlite'
import { evmWallets } from './lib/db/schema'
import type { RPC } from '../lib/rpc-schema'

const env = getENV()

console.log(env)

if (env.env === 'prod') {
	migrate(db, {
		migrationsFolder: join(PATHS.RESOURCES_FOLDER, 'app', 'drizzle'),
	})
}

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

const moneroState = {
	manager: null as MoneroWalletState | null,
	downloading: false,
}
const syncState = {
	target: null as { address: string; chainid: string } | null,
	timer: null as ReturnType<typeof setInterval> | null,
}

const rpc = BrowserView.defineRPC<RPC>({
	maxRequestTime: 120000,
	handlers: {
		requests: {},
		messages: {},
	},
})

rpc.setRequestHandler({
	resetApp: async () => {
		try {
			const wallets = db.select().from(evmWallets).all()
			await Promise.all([
				Bun.secrets.delete({
					service: 'koins',
					name: 'alchemy_key',
				}),
				...wallets.flatMap((w) => [
					Bun.secrets.delete({
						service: 'koins',
						name: w.vaultKey,
					}),
					Bun.secrets.delete({
						service: 'koins',
						name: `evm_auth_${w.id}`,
					}),
				]),
			])
			sqlite.run('DELETE FROM token_metadata')
			sqlite.run('DELETE FROM transactions')
			sqlite.run('DELETE FROM transaction_receipts')
			sqlite.run('DELETE FROM tx_history')
			sqlite.run('DELETE FROM evm_wallets')
			console.log('[rpc] resetApp complete')
			return true
		} catch (e) {
			console.log('[rpc] resetApp error:', e)
			return false
		}
	},
	biometricCanAuth: async () => {
		console.log('[biometric] checking biometric...')
		try {
			const canPrompt = canPromptTouchID()
			console.log('[biometric] biometric ===', canPrompt)
			return canPrompt
		} catch {
			return false
		}
	},
	biometricAuth: async ({ reason }) => {
		try {
			return promptTouchID(reason)
		} catch {
			return false
		}
	},
	getSecret: async ({ name, service }) => {
		return await Bun.secrets.get({ name, service })
	},
	setSecret: async ({ name, service, value }) => {
		await Bun.secrets.set({ name, service, value })
	},
	openExternal: async ({ url }) => {
		Utils.openExternal(url)
	},
	generateQrCode: async ({ text, size }) => {
		const { default: QRCode } = await import('qrcode')
		return QRCode.toString(text, {
			type: 'svg',
			width: size ?? 128,
			margin: 1,
		})
	},
	...createEvmHandlers(rpc, syncState),
	...createMoneroHandlers(moneroState),
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

console.log('Koins app started!')
