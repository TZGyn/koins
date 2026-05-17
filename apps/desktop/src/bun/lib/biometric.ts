import { existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { PATHS } from 'electrobun/bun'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

function findHelper(): string {
	const candidates = [
		join(__dirname, '..', 'native', 'biometric-helper'),
		join(PATHS.RESOURCES_FOLDER, 'native', 'biometric-helper'),
	]
	for (const p of candidates) {
		if (existsSync(p)) return p
	}
	throw new Error(
		`biometric-helper not found at any of:\n${candidates.join('\n')}`,
	)
}

const HELPER_PATH = findHelper()

export function canPromptTouchID(): boolean {
	const result = Bun.spawnSync([HELPER_PATH, '--check'])
	return result.exitCode === 0
}

export function promptTouchID(reason: string): boolean {
	const result = Bun.spawnSync([HELPER_PATH, reason])
	return result.exitCode === 0
}
