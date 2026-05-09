import { createApp } from '$routes/index'
import { Elysia } from 'elysia'
import path from 'node:path'
import readline from 'node:readline'
import { pathToFileURL } from 'bun'
import chokidar from 'chokidar'
import { Cron } from 'croner'
import { onFileCreate } from './hooks/on-file-create'
import { transformToUrl } from './utils/transform-to-url'

export function addRelativeIfNotDot(path: string) {
	if (path.charAt(0) !== '.') return `./${path}`

	return path
}

export function globSync(
	globPattern: string,
	globOptions: { cwd?: string },
) {
	return Array.from(new Bun.Glob(globPattern).scanSync(globOptions))
}

export function getPath(dir: string) {
	if (path.isAbsolute(dir)) return dir
	if (path.isAbsolute(process.argv[1]))
		return path.join(process.argv[1], '..', dir)

	return path.join(process.cwd(), process.argv[1], '..', dir)
}

const fileRouter = async () => {
	const directoryPath = getPath('../src/routes')

	const globPattern = '**/*.{ts,tsx,js,jsx,mjs,cjs}'
	const globOptions = { cwd: directoryPath }

	const files = globSync(globPattern, globOptions)

	const plugin = new Elysia({ name: 'file-router' })

	// insert imports

	const paths: [path: string, exportName: string][] = []

	for (const filepath of files) {
		const fullPath = path.join(directoryPath, filepath)
		const file = await import(pathToFileURL(fullPath).href)

		// prettier-ignore
		delete require.cache[require.resolve(pathToFileURL(fullPath).href)]

		const url = transformToUrl(filepath)

		if (!file['route']) continue

		const importedValue = file['route']

		plugin.group(url, {}, (app) => app.use(importedValue))

		paths.push([fullPath.replace(directoryPath, ''), 'route'])
	}

	const outputAbsolutePath = './src/route-types.ts'

	const imports: string[] = paths.map(
		([filePath, exportName], index) => {
			const importPath = filePath.replace(/\.(ts|tsx)$/, '')

			return `import type ${
				exportName === 'default'
					? `Route${index}`
					: `{ ${exportName} as Route${index} }`
			} from "${addRelativeIfNotDot(
				path
					.relative(
						path.dirname(outputAbsolutePath),
						path.join(directoryPath, importPath),
					)
					.replaceAll('\\', '/'),
			)}";`
		},
	)

	const input = [
		`import type { ElysiaWithBaseUrl } from "../file-router/types.ts";`,
		imports.join('\n'),
		'',
		`export type Route = ${paths
			.map(
				([x], index) =>
					`ElysiaWithBaseUrl<"${
						transformToUrl(x) || '/'
					}", typeof Route${index}>`,
			)
			.join('\n\t\t\t& ')}`,
	].join('\n')

	await Bun.file(outputAbsolutePath).write(input)

	return plugin
}

function clearScreen() {
	const repeatCount = process.stdout.rows - 2
	const blank = repeatCount > 0 ? '\n'.repeat(repeatCount) : ''
	console.log(blank)
	readline.cursorTo(process.stdout, 0, 0)
	readline.clearScreenDown(process.stdout)
}

let app = createApp()
app.use(await fileRouter())

const server = Bun.serve({
	fetch: app.fetch,
	port: Bun.env.PORT ?? 3000,
})

const reloadServer = async () => {
	if ('cron' in app.store) {
		// @ts-ignore
		const cron = app.store.cron as Record<string, Cron>
		for (const [key, value] of Object.entries(cron)) {
			// @ts-ignore
			app.store.cron[key].stop()
		}
	}
	app = createApp()
	app.use(await fileRouter())

	server.reload({ fetch: app.fetch })

	clearScreen()
	console.log(
		`🦊 Elysia is running at http://${server.hostname}:${server.port}`,
	)
}

const watch = () => {
	chokidar
		.watch('./src/routes', { persistent: true })
		.on('all', async (event, path) => {
			console.log(event, path)

			for (const path of Object.keys(require.cache)) {
				delete require.cache[path]
			}

			try {
				await reloadServer()
			} catch (error) {
				console.error(error)
			}
		})
		.on('add', async (path, stats) => {
			console.log(path, stats)

			try {
				await onFileCreate(path, stats)
			} catch (error) {
				console.error(error)
			}
		})

	chokidar
		.watch('./lib', { persistent: true })
		.on('all', async (event, path) => {
			console.log(event, path)

			for (const path of Object.keys(require.cache)) {
				delete require.cache[path]
			}

			try {
				await reloadServer()
			} catch (error) {
				console.error(error)
			}
		})
}

watch()
