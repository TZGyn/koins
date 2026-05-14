import { defineConfig } from 'drizzle-kit'
import envPaths from 'env-paths'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { getENV } from './src/bun/lib/get-env'

const env = getENV()

const { data } = envPaths(env.appName, { suffix: '' })
mkdirSync(data, { recursive: true })

export default defineConfig({
	out: './drizzle',
	schema: './src/bun/lib/db/schema.ts',
	dialect: 'sqlite',
	dbCredentials: {
		url: join(data, env.dbFilename),
	},
})
