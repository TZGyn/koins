import { Database } from 'bun:sqlite'
import envPaths from 'env-paths'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { getENV } from '../get-env'

const env = getENV()

const { data } = envPaths(env.appName, { suffix: '' })
mkdirSync(data, { recursive: true })

console.log(data)

export const sqlite = new Database(join(data, env.dbFilename), {
	create: true,
})
