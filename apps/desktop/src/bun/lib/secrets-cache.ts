import { getENV } from './get-env'

const env = getENV()
export const VAULT_SERVICE = env.appName
const VAULT_NAME = 'vault'

const cache = new Map<string, string>()
const key = (service: string, name: string) => `${service}:${name}`

let loaded = false
let loadPromise: Promise<void> | null = null
let writeChain: Promise<void> = Promise.resolve()

async function ensureLoaded(): Promise<void> {
	if (loaded) return
	if (!loadPromise) {
		loadPromise = (async () => {
			const raw = await Bun.secrets.get({
				service: VAULT_SERVICE,
				name: VAULT_NAME,
			})
			if (raw) {
				try {
					const data = JSON.parse(raw) as Record<string, string>
					for (const [k, v] of Object.entries(data)) cache.set(k, v)
				} catch (e) {
					console.log('[secrets] vault parse error:', e)
				}
			}
			loaded = true
		})()
	}
	await loadPromise
}

async function persist(): Promise<void> {
	const raw = JSON.stringify(Object.fromEntries(cache))
	writeChain = writeChain.then(() =>
		Bun.secrets.set({
			service: VAULT_SERVICE,
			name: VAULT_NAME,
			value: raw,
		}),
	)
	return writeChain
}

export async function getSecret(
	service: string,
	name: string,
): Promise<string | null> {
	const k = key(service, name)
	await ensureLoaded()
	return cache.get(k) ?? null
}

export async function setSecret(
	service: string,
	name: string,
	value: string,
): Promise<void> {
	await ensureLoaded()
	cache.set(key(service, name), value)
	await persist()
}

export async function deleteSecret(
	service: string,
	name: string,
): Promise<void> {
	if (service === VAULT_SERVICE && name === VAULT_NAME) {
		cache.clear()
		loaded = false
		loadPromise = null
		await Bun.secrets.delete({ service, name })
		return
	}
	await ensureLoaded()
	cache.delete(key(service, name))
	await persist()
}

export function clearSecretsCache(): void {
	cache.clear()
	loaded = false
	loadPromise = null
}
