import { PATHS } from 'electrobun/bun'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

function detectEnv(): { env: string; appName: string; dbFilename: string } {
	const channel = (Bun.env.ELECTROBUN_ENV as string) || ''
	if (channel === 'stable') {
		return { env: 'stable', appName: 'koins', dbFilename: 'koins.db' }
	}

	try {
		const p = join(PATHS.RESOURCES_FOLDER, 'version.json')
		if (existsSync(p)) {
			const { channel: c } = JSON.parse(readFileSync(p, 'utf-8'))
			if (c === 'stable') {
				return { env: 'stable', appName: 'koins', dbFilename: 'koins.db' }
			}
		}
	} catch {}

	return { env: 'dev', appName: 'koins-dev', dbFilename: 'koins-dev.db' }
}

const env = detectEnv()

console.log('ENV', env.env)

export const getENV = () => env
