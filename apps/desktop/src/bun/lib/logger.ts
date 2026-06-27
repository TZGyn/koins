import { appendFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import envPaths from 'env-paths'
import { getENV } from './get-env'

const { appName } = getENV()
const { data } = envPaths(appName, { suffix: '' })
const logDir = join(data, 'logs')
mkdirSync(logDir, { recursive: true })

const date = () => {
	const d = new Date()
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const file = join(logDir, `${appName}-${date()}.log`)

export const log = (msg: string) => {
	const line = `[${new Date().toISOString()}] ${msg}\n`
	try {
		appendFileSync(file, line, 'utf-8')
	} catch {}
}

export const logError = (msg: string, err?: unknown) => {
	const detail = err instanceof Error ? err.stack || err.message : String(err ?? '')
	log(`[ERROR] ${msg}${detail ? ' — ' + detail : ''}`)
}
