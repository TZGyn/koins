import {
	ApplicationMenu,
	BrowserView,
	BrowserWindow,
	PATHS,
	Updater,
	Utils,
} from 'electrobun/bun'
import { join } from 'path'
import { existsSync } from 'fs'
import { getENV } from './lib/get-env'
import { createMoneroHandlers } from './rpc/monero'
import { createXrpHandlers } from './rpc/xrp'
import { stop as walletStop } from './lib/monero'
import type { MoneroWalletState } from './lib/monero'
import { canPromptTouchID, promptTouchID } from './lib/biometric'
import {
	getSecret,
	setSecret,
	deleteSecret,
	clearSecretsCache,
	VAULT_SERVICE,
} from './lib/secrets-cache'
import type { RPC } from '../lib/rpc-schema'
import { log } from './lib/logger'

const env = getENV()

log(`env: ${JSON.stringify(env)}`)

const DEV_SERVER_PORT = 5173
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`

async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel()
	log(`channel from Updater: ${channel}`)
	if (channel === 'dev') {
		try {
			await fetch(DEV_SERVER_URL, { method: 'HEAD' })
			log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`)
			return DEV_SERVER_URL
		} catch {
			log("Vite dev server not running, falling back to bundled view")
		}
	}
	log('using bundled view')
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

log(`view URL: ${url}`)
const viewsRoot = join(PATHS.RESOURCES_FOLDER, 'app', 'views')
log(`viewsRoot: ${viewsRoot}`)
log(`viewsRoot exists: ${existsSync(viewsRoot)}`)
log(`index.html exists: ${existsSync(join(viewsRoot, 'mainview', 'index.html'))}`)

const moneroState = {
	manager: null as MoneroWalletState | null,
	downloading: false,
}

async function stopWalletServers(): Promise<void> {
	if (moneroState.manager) {
		const manager = moneroState.manager
		moneroState.manager = null
		await walletStop(manager)
	}
}

// Save the monero wallet and shut down wallet-rpc gracefully on app quit
// (otherwise an orphaned process keeps the scan progress only in memory).
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
	process.on(signal, () => {
		log(`${signal} received, stopping wallet servers...`)
		void stopWalletServers().finally(() => process.exit(0))
		setTimeout(() => process.exit(0), 5000).unref?.()
	})
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
			await deleteSecret(VAULT_SERVICE, 'vault')
			clearSecretsCache()
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
		return await getSecret(service, name)
	},
	setSecret: async ({ name, service, value }) => {
		await setSecret(service, name, value)
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
	logToFile: async ({ message }) => {
		log(message)
	},
	...createMoneroHandlers(moneroState),
	...createXrpHandlers(),
})

log('creating BrowserWindow...')
const win = new BrowserWindow({
	title: 'Koins',
	url,
	rpc,
	viewsRoot: join(PATHS.RESOURCES_FOLDER, 'app', 'views'),
	frame: {
		width: 900,
		height: 700,
		x: 200,
		y: 200,
	},
})
log('BrowserWindow created')

log('Koins app started!')
