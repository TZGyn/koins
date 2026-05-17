import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import envPaths from 'env-paths'
import { getENV } from '../get-env'

const env = getENV()
const { data } = envPaths(env.appName, { suffix: '' })

export const MONERO_VERSION = '0.18.5.0'

const PLATFORM_MAP: Record<string, Record<string, string>> = {
	darwin: { arm64: 'mac-armv8', x64: 'mac-x64' },
	linux: { arm64: 'linux-armv8', x64: 'linux-x64' },
}

function getPlatform(): string {
	const os = PLATFORM_MAP[process.platform]
	if (!os)
		throw new Error(
			`Unsupported platform: ${process.platform} ${process.arch}`,
		)
	const arch = os[process.arch]
	if (!arch)
		throw new Error(
			`Unsupported arch: ${process.arch} on ${process.platform}`,
		)
	return arch
}

export function getDownloadUrl(): string {
	return `https://downloads.getmonero.org/cli/monero-${getPlatform()}-v${MONERO_VERSION}.tar.bz2`
}

export function getBinaryDir(): string {
	const dir = join(data, 'monero-bin')
	mkdirSync(dir, { recursive: true })
	return dir
}

export function getBinaryPath(): string {
	return join(getBinaryDir(), 'monero-wallet-rpc')
}

export function getWalletDir(): string {
	const dir = join(data, 'monero-wallets')
	mkdirSync(dir, { recursive: true })
	return dir
}

export function isBinaryInstalled(): boolean {
	return existsSync(getBinaryPath())
}

export async function downloadBinary(): Promise<void> {
	const url = getDownloadUrl()
	const archivePath = join(
		getBinaryDir(),
		`monero-v${MONERO_VERSION}.tar.bz2`,
	)

	console.log(`Downloading Monero CLI ${MONERO_VERSION}...`)
	console.log(`URL: ${url}`)
	const response = await fetch(url)
	if (!response.ok)
		throw new Error(
			`Download failed: ${response.status} ${response.statusText}`,
		)

	const total = Number(response.headers.get('content-length') ?? 0)
	console.log(`Download size: ${(total / 1024 / 1024).toFixed(1)} MB`)

	const reader = response.body?.getReader()
	if (!reader) throw new Error('No response body')

	const chunks: Uint8Array[] = []
	let received = 0
	while (true) {
		const { done, value } = await reader.read()
		if (done) break
		chunks.push(value)
		received += value.length
		const pct = total ? ((received / total) * 100).toFixed(0) : '?'
		console.log(
			`Download progress: ${pct}% (${(received / 1024 / 1024).toFixed(1)} MB)`,
		)
	}

	const buffer = new Uint8Array(received)
	let offset = 0
	for (const chunk of chunks) {
		buffer.set(chunk, offset)
		offset += chunk.length
	}

	await Bun.write(archivePath, buffer)
	console.log(`Downloaded to ${archivePath}`)

	console.log('Extracting...')
	const result = Bun.spawnSync(['tar', '-xjf', archivePath, '--strip-components=1', '-C', getBinaryDir()])
	if (result.exitCode !== 0) throw new Error(`Extraction failed: ${result.stderr.toString()}`)

	Bun.spawnSync(['rm', archivePath])

	const binaryDst = getBinaryPath()
	if (!existsSync(binaryDst)) throw new Error(`monero-wallet-rpc not found after extraction`)

	Bun.spawnSync(['chmod', '+x', binaryDst])

	console.log(`Installed monero-wallet-rpc at ${binaryDst}`)
}
