import { getParamsFromFilePath } from '../utils/get-params-from-file-path'
import { transformToUrl } from '../utils/transform-to-url'

type Stats = {
	isFile(): boolean
	isDirectory(): boolean
	isBlockDevice(): boolean
	isCharacterDevice(): boolean
	isSymbolicLink(): boolean
	isFIFO(): boolean
	isSocket(): boolean
	dev: number
	ino: number
	mode: number
	nlink: number
	uid: number
	gid: number
	rdev: number
	size: number
	blksize: number
	blocks: number
	atimeMs: number
	mtimeMs: number
	ctimeMs: number
	birthtimeMs: number
	atime: Date
	mtime: Date
	ctime: Date
	birthtime: Date
}

const generateTemplate = ({ params }: { params?: string }) => {
	let config = ''
	if (params) {
		config += `{ params: ${params} }`
	}

	if (config.length > 0) {
		config = ',' + config
	}

	return `import Elysia from 'elysia'
import { betterAuth } from '$lib/plugin/better-auth'

export const route = new Elysia()
	.use(betterAuth)
	.get('/', async () => {
		return 'hello'
	}${config})
`
}

export const onFileCreate = async (path: string, stats?: Stats) => {
	const file = Bun.file(path)

	const params = getParamsFromFilePath(path)

	const paramsTemplate = getParamsTemplate(params)

	let template: string

	template = generateTemplate({ params: paramsTemplate })

	if ((await file.text()) === '') {
		await file.write(template)

		console.log(await Bun.$`bunx prettier --write ${path}`)
	}
}

const getParamsTemplate = (params: string[]) => {
	let result = ''

	if (params.length > 0) {
		result += `t.Object({`

		params.map((param) => {
			result += `"${param}": t.String(),`
		})

		result += `})`
	}

	return result
}
