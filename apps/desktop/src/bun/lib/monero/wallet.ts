import { MoneroWalletRpc, MoneroRpcConnection, connectToWalletRpc, connectToDaemonRpc } from 'monero-ts'
import { getBinaryPath, getWalletDir } from './binary'
import { existsSync } from 'fs'

const DEFAULT_DAEMON = 'xmr-node.cakewallet.com:18081'

export class MoneroWalletManager {
	private wallet: MoneroWalletRpc | null = null
	private process: Bun.Subprocess | null = null
	private rpcPort: number
	private rpcUser: string
	private rpcPassword: string
	private daemonAddress: string = DEFAULT_DAEMON

	constructor() {
		this.rpcPort = 28084
		this.rpcUser = 'koins'
		this.rpcPassword = crypto.randomUUID()
	}

	private get rpcUrl() {
		return `http://127.0.0.1:${this.rpcPort}`
	}

	private get rpcConnection(): MoneroRpcConnection {
		return new MoneroRpcConnection({
			uri: this.rpcUrl,
			username: this.rpcUser,
			password: this.rpcPassword,
		})
	}

	async start(daemonAddress: string = DEFAULT_DAEMON) {
		if (!existsSync(getBinaryPath())) throw new Error('monero-wallet-rpc not installed. Call downloadBinary() first.')
		this.daemonAddress = daemonAddress

		console.log(`[monero] starting wallet-rpc process...`)
		console.log(`[monero] daemon address: ${this.daemonAddress}`)
		console.log(`[monero] wallet dir: ${getWalletDir()}`)

		const cmd = [
			getBinaryPath(),
			'--daemon-address', this.daemonAddress,
			'--rpc-bind-port', String(this.rpcPort),
			'--rpc-bind-ip', '127.0.0.1',
			'--wallet-dir', getWalletDir(),
			'--rpc-login', `${this.rpcUser}:${this.rpcPassword}`,
			'--trusted-daemon',
		]

		console.log(`[monero] spawning: ${cmd.join(' ')}`)
		this.process = Bun.spawn(cmd, {
			env: { ...process.env, LANG: 'en_US.UTF-8' },
			stdout: 'pipe',
			stderr: 'pipe',
			onExit(_proc, exitCode, _signalCode, error) {
				console.log(`[monero] wallet-rpc process exited with code ${exitCode}`, error?.message ?? '')
			},
		})
		console.log(`[monero] wallet-rpc pid: ${this.process.pid}`)

		const stdout = this.process.stdout.getReader()
		;(async () => {
			while (true) {
				const { done, value } = await stdout.read()
				if (done) break
				console.log(`[monero:stdout] ${new TextDecoder().decode(value)}`)
			}
		})()

		const stderr = this.process.stderr.getReader()
		;(async () => {
			while (true) {
				const { done, value } = await stderr.read()
				if (done) break
				console.log(`[monero:stderr] ${new TextDecoder().decode(value)}`)
			}
		})()

		console.log(`[monero] waiting for RPC server to become available...`)
		await this.waitForRpc()
		console.log(`[monero] RPC server is ready`)

		console.log(`[monero] connecting MoneroWalletRpc client...`)
		this.wallet = await connectToWalletRpc(this.rpcUrl, this.rpcUser, this.rpcPassword) as MoneroWalletRpc
		console.log(`[monero] MoneroWalletRpc connected successfully`)
	}

	private async rawRpc(method: string, params: Record<string, any> = {}): Promise<any> {
		const conn = this.rpcConnection
		const res = await conn.sendJsonRequest(method, params)
		if (res?.error) throw new Error(res.error.message || JSON.stringify(res.error))
		return res?.result
	}

	private async waitForRpc(timeoutMs = 30000): Promise<void> {
		const start = Date.now()
		let lastErr = ''
		while (Date.now() - start < timeoutMs) {
			try {
				await Bun.connect({
					hostname: '127.0.0.1',
					port: this.rpcPort,
					socket: { open(s) { s.end() }, close() {}, data() {}, error() {} },
				})
				console.log(`[monero] RPC ready after ${Date.now() - start}ms`)
				return
			} catch (e) {
				lastErr = String(e)
			}
			await new Promise(r => setTimeout(r, 500))
		}
		throw new Error(`monero-wallet-rpc failed to start within ${timeoutMs}ms: ${lastErr}`)
	}

	async stop() {
		console.log(`[monero] stopping wallet manager...`)
		if (this.process) {
			console.log(`[monero] killing wallet-rpc process (pid ${this.process.pid})`)
			this.process.kill()
			this.process = null
		}
		this.wallet = null
		console.log(`[monero] wallet manager stopped`)
	}

	async createWallet(name: string, password: string) {
		console.log(`[monero] creating wallet: ${name}`)
		const result = await this.rawRpc('create_wallet', {
			filename: name,
			password,
			language: 'English',
		})
		if (!this.wallet) throw new Error('Wallet RPC not started')
		const address = await this.wallet.getAddress(0, 0)
		console.log(`[monero] wallet created: ${name} -> ${address}`)
		return { mnemonic: result.mnemonic, address }
	}

	async restoreWallet(name: string, password: string, mnemonic: string, restoreHeight?: number) {
		console.log(`[monero] restoring wallet: ${name} (height: ${restoreHeight ?? 0})`)
		await this.rawRpc('restore_deterministic_wallet', {
			filename: name,
			password,
			seed: mnemonic,
			restore_height: restoreHeight ?? 0,
			language: 'English',
		})
		console.log(`[monero] wallet restored: ${name}`)
	}

	async openWallet(name: string, password: string) {
		console.log(`[monero] opening wallet: ${name}`)
		if (!this.wallet) throw new Error('Wallet RPC not started')
		await this.wallet.openWallet(name, password)
		console.log(`[monero] wallet opened: ${name}`)
	}

	async closeWallet() {
		console.log(`[monero] closing current wallet`)
		if (!this.wallet) throw new Error('Wallet RPC not started')
		await this.wallet.close()
		console.log(`[monero] wallet closed`)
	}

	async getBalance(): Promise<{ balance: bigint; unlocked: bigint }> {
		if (!this.wallet) throw new Error('Wallet RPC not started')
		const bal = await this.wallet.getBalance() as bigint
		const unlocked = await this.wallet.getUnlockedBalance() as bigint
		console.log(`[monero] balance: ${bal} (unlocked: ${unlocked})`)
		return { balance: bal, unlocked }
	}

	async getAddress(accountIdx = 0, subIdx = 0): Promise<string> {
		if (!this.wallet) throw new Error('Wallet RPC not started')
		const address = await this.wallet.getAddress(accountIdx, subIdx) as string
		console.log(`[monero] address: ${address}`)
		return address
	}

	async getAccounts(): Promise<any[]> {
		if (!this.wallet) throw new Error('Wallet RPC not started')
		const accounts = await this.wallet.getAccounts(true) as any[]
		console.log(`[monero] accounts: ${accounts?.length ?? 0} returned`)
		return accounts?.map(a => a.toJson()) ?? []
	}

	async getTransactions(): Promise<any[]> {
		if (!this.wallet) throw new Error('Wallet RPC not started')
		const txs = await this.wallet.getTxs() as any[]
		console.log(`[monero] transactions: ${txs?.length ?? 0} returned`)
		if (txs?.length) {
			for (const tx of txs.slice(0, 5)) {
				console.log(`[monero]   tx: hash=${tx.hash?.substring(0, 12) ?? '?'} amount=${tx.amount?.toString() ?? '0'} dir=${tx.direction} height=${tx.height ?? 0}`)
			}
			if (txs.length > 5) console.log(`[monero]   ... and ${txs.length - 5} more`)
		}
		return txs ?? []
	}

	async getHeight(): Promise<number> {
		if (!this.wallet) throw new Error('Wallet RPC not started')
		const height = await this.wallet.getHeight() as number
		console.log(`[monero] wallet height: ${height}`)
		return height
	}

	async getDaemonHeight(): Promise<number> {
		if (!this.wallet) throw new Error('Wallet RPC not started')
		try {
			const daemon = await connectToDaemonRpc(`http://${this.daemonAddress}`)
			const height = await daemon.getHeight() as number
			console.log(`[monero] daemon height: ${height}`)
			return height
		} catch (e) {
			console.log(`[monero] failed to get daemon height:`, e)
			return 0
		}
	}

	async isWalletOpen(): Promise<boolean> {
		if (!this.wallet) return false
		try {
			await this.wallet.getHeight()
			return true
		} catch {
			return false
		}
	}

	async isConnected(): Promise<boolean> {
		if (!this.wallet) return false
		try {
			const daemon = await connectToDaemonRpc(`http://${this.daemonAddress}`)
			await daemon.getHeight()
			return true
		} catch (e) {
			console.log(`[monero] connection check failed:`, e)
			return false
		}
	}
}
