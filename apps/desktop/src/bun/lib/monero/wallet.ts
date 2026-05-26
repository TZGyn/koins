import {
	MoneroWalletRpc,
	MoneroRpcConnection,
	connectToWalletRpc,
	connectToDaemonRpc,
} from 'monero-ts'
import { getBinaryPath, getWalletDir } from './binary'
import { existsSync, readdirSync } from 'fs'

const DEFAULT_DAEMON = 'xmr-node.cakewallet.com:18081'

export type MoneroWalletState = {
	wallet: MoneroWalletRpc | null
	process: Bun.Subprocess | null
	rpcPort: number
	rpcUser: string
	rpcPassword: string
	daemonAddress: string
}

export function createMoneroWalletState(): MoneroWalletState {
	return {
		wallet: null,
		process: null,
		rpcPort: 28084,
		rpcUser: 'koins',
		rpcPassword: crypto.randomUUID(),
		daemonAddress: DEFAULT_DAEMON,
	}
}

function rpcUrl(state: MoneroWalletState): string {
	return `http://127.0.0.1:${state.rpcPort}`
}

function rpcConnection(
	state: MoneroWalletState,
): MoneroRpcConnection {
	return new MoneroRpcConnection({
		uri: rpcUrl(state),
		username: state.rpcUser,
		password: state.rpcPassword,
	})
}

async function rawRpc(
	state: MoneroWalletState,
	method: string,
	params: Record<string, any> = {},
): Promise<any> {
	const conn = rpcConnection(state)
	const res = await conn.sendJsonRequest(method, params)
	if (res?.error)
		throw new Error(res.error.message || JSON.stringify(res.error))
	return res?.result
}

async function waitForRpc(
	state: MoneroWalletState,
	timeoutMs = 30000,
): Promise<void> {
	const start = Date.now()
	let lastErr = ''
	while (Date.now() - start < timeoutMs) {
		try {
			await Bun.connect({
				hostname: '127.0.0.1',
				port: state.rpcPort,
				socket: {
					open(s) {
						s.end()
					},
					close() {},
					data() {},
					error() {},
				},
			})
			console.log(`[monero] RPC ready after ${Date.now() - start}ms`)
			return
		} catch (e) {
			lastErr = String(e)
		}
		await new Promise((r) => setTimeout(r, 500))
	}
	throw new Error(
		`monero-wallet-rpc failed to start within ${timeoutMs}ms: ${lastErr}`,
	)
}

export async function start(
	state: MoneroWalletState,
	daemonAddress: string = DEFAULT_DAEMON,
) {
	if (!existsSync(getBinaryPath()))
		throw new Error(
			'monero-wallet-rpc not installed. Call downloadBinary() first.',
		)
	state.daemonAddress = daemonAddress

	console.log(`[monero] starting wallet-rpc process...`)
	console.log(`[monero] daemon address: ${state.daemonAddress}`)
	console.log(`[monero] wallet dir: ${getWalletDir()}`)

	const cmd = [
		getBinaryPath(),
		'--daemon-address',
		state.daemonAddress,
		'--rpc-bind-port',
		String(state.rpcPort),
		'--rpc-bind-ip',
		'127.0.0.1',
		'--wallet-dir',
		getWalletDir(),
		'--rpc-login',
		`${state.rpcUser}:${state.rpcPassword}`,
		'--trusted-daemon',
	]

	console.log(`[monero] spawning: ${cmd.join(' ')}`)
	state.process = Bun.spawn(cmd, {
		env: { ...process.env, LANG: 'en_US.UTF-8' },
		stdout: 'pipe',
		stderr: 'pipe',
		onExit(_proc, exitCode, _signalCode, error) {
			console.log(
				`[monero] wallet-rpc process exited with code ${exitCode}`,
				error?.message ?? '',
			)
		},
	})
	console.log(`[monero] wallet-rpc pid: ${state.process.pid}`)

	const reader = (state.process!.stdout as ReadableStream<Uint8Array>).getReader()
	;(async () => {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			console.log(
				`[monero:stdout] ${new TextDecoder().decode(value)}`,
			)
		}
	})()

	const stderr = (state.process!.stderr as ReadableStream<Uint8Array>).getReader()
	;(async () => {
		while (true) {
			const { done, value } = await stderr.read()
			if (done) break
			console.log(
				`[monero:stderr] ${new TextDecoder().decode(value)}`,
			)
		}
	})()

	console.log(
		`[monero] waiting for RPC server to become available...`,
	)
	await waitForRpc(state)
	console.log(`[monero] RPC server is ready`)

	console.log(`[monero] connecting MoneroWalletRpc client...`)
	state.wallet = (await connectToWalletRpc(
		rpcUrl(state),
		state.rpcUser,
		state.rpcPassword,
	)) as MoneroWalletRpc
	console.log(`[monero] MoneroWalletRpc connected successfully`)
}

export async function stop(state: MoneroWalletState) {
	console.log(`[monero] stopping wallet manager...`)
	if (state.process) {
		console.log(
			`[monero] killing wallet-rpc process (pid ${state.process.pid})`,
		)
		state.process.kill()
		state.process = null
	}
	state.wallet = null
	console.log(`[monero] wallet manager stopped`)
}

export async function createWallet(
	state: MoneroWalletState,
	name: string,
	password: string,
) {
	console.log(`[monero] creating wallet: ${name}`)
	const result = await rawRpc(state, 'create_wallet', {
		filename: name,
		password,
		language: 'English',
	})
	if (!state.wallet) throw new Error('Wallet RPC not started')
	const address = await state.wallet.getAddress(0, 0)
	console.log(`[monero] wallet created: ${name} -> ${address}`)
	return { mnemonic: result.mnemonic, address }
}

export async function restoreWallet(
	state: MoneroWalletState,
	name: string,
	password: string,
	mnemonic: string,
	restoreHeight?: number,
) {
	console.log(
		`[monero] restoring wallet: ${name} (height: ${restoreHeight ?? 0})`,
	)
	await rawRpc(state, 'restore_deterministic_wallet', {
		filename: name,
		password,
		seed: mnemonic,
		restore_height: restoreHeight ?? 0,
		language: 'English',
	})
	console.log(`[monero] wallet restored: ${name}`)
}

export async function openWallet(
	state: MoneroWalletState,
	name: string,
	password: string,
) {
	console.log(`[monero] opening wallet: ${name}`)
	if (!state.wallet) throw new Error('Wallet RPC not started')
	await state.wallet.openWallet(name, password)
	console.log(`[monero] wallet opened: ${name}`)
}

export async function closeWallet(state: MoneroWalletState) {
	console.log(`[monero] closing current wallet`)
	if (!state.wallet) throw new Error('Wallet RPC not started')
	await state.wallet.close()
	console.log(`[monero] wallet closed`)
}

export async function getBalance(
	state: MoneroWalletState,
): Promise<{ balance: bigint; unlocked: bigint }> {
	if (!state.wallet) throw new Error('Wallet RPC not started')
	const balance = (await state.wallet.getBalance()) as bigint
	const unlocked = (await state.wallet.getUnlockedBalance()) as bigint
	console.log(`[monero] balance: ${balance} (unlocked: ${unlocked})`)
	return { balance, unlocked }
}

export async function getAddress(
	state: MoneroWalletState,
	accountIdx = 0,
	subIdx = 0,
): Promise<string> {
	if (!state.wallet) throw new Error('Wallet RPC not started')
	const address = (await state.wallet.getAddress(
		accountIdx,
		subIdx,
	)) as string
	console.log(`[monero] address: ${address}`)
	return address
}

export async function getAccounts(
	state: MoneroWalletState,
): Promise<any[]> {
	if (!state.wallet) throw new Error('Wallet RPC not started')
	const accounts = (await state.wallet.getAccounts(true)) as any[]
	console.log(`[monero] accounts: ${accounts?.length ?? 0} returned`)
	if (accounts?.length) {
		for (const acct of accounts) {
			const subs = acct.getSubaddresses() ?? []
			console.log(
				`[monero]   account ${acct.getIndex()}: balance=${acct.getBalance()?.toString() ?? '0'} subs=${subs.length} primary=${(acct.getPrimaryAddress() ?? '').substring(0, 16)}...`,
			)
			const has0 = subs.some((s: any) => s.getIndex() === 0)
			if (!has0)
				console.log(
					`[monero]     sub 0 (primary): addr=${(acct.getPrimaryAddress() ?? '').substring(0, 16)}...`,
				)
			for (const sub of subs) {
				console.log(
					`[monero]     sub ${sub.getIndex()}: addr=${(sub.getAddress() ?? '').substring(0, 16)}... label=${sub.getLabel() ?? ''} balance=${sub.getBalance()?.toString() ?? '0'} used=${sub.getIsUsed()}`,
				)
			}
		}
	}
	return accounts?.map((a) => a.toJson()) ?? []
}

export async function getTransactions(
	state: MoneroWalletState,
	accountIndex?: number,
): Promise<any[]> {
	if (!state.wallet) throw new Error('Wallet RPC not started')
	const params: Record<string, any> = {
		in: true,
		out: true,
		pending: false,
		pool: false,
	}
	if (accountIndex !== undefined) params.account_index = accountIndex
	const result = await rawRpc(state, 'get_transfers', params)
	const all: any[] = []
	for (const dir of ['in', 'out'] as const) {
		const transfers = result[dir] ?? []
		for (const t of transfers) {
			all.push({
				hash: t.txid,
				amount: t.amount?.toString() ?? '0',
				timestamp: String(t.timestamp ?? 0),
				direction: dir === 'in' ? ('in' as const) : ('out' as const),
				height: t.height ?? 0,
				note: t.note,
			})
		}
	}
	all.sort(
		(a: any, b: any) => Number(b.timestamp) - Number(a.timestamp),
	)
	console.log(
		`[monero] transactions: ${all.length} returned${accountIndex !== undefined ? ` for account ${accountIndex}` : ''}`,
	)
	return all
}

export async function getTransferDetails(
	state: MoneroWalletState,
	txid: string,
): Promise<any> {
	if (!state.wallet) throw new Error('Wallet RPC not started')
	const result = await rawRpc(state, 'get_transfer_by_txid', { txid })
	if (!result?.transfer) return null
	const t = result.transfer
	const isIn = t.type === 'in'
	const isOut = t.type === 'out'
	const dests =
		t.destinations?.map((d: any) => ({
			address: d.address,
			amount: d.amount?.toString() ?? '0',
		})) ?? []
	const subaddrIndices = isIn
		? [
				{
					major: t.subaddr_index?.major ?? 0,
					minor: t.subaddr_index?.minor ?? 0,
				},
			]
		: (t.subaddr_indices ?? []).map((s: any) => ({
				major: s.major ?? 0,
				minor: s.minor ?? 0,
			}))
	return {
		hash: t.txid,
		direction: isIn ? ('in' as const) : ('out' as const),
		amount: t.amount?.toString() ?? '0',
		fee: t.fee?.toString() ?? '0',
		height: t.height ?? 0,
		timestamp: String(t.timestamp ?? 0),
		confirmations: t.confirmations ?? 0,
		unlockTime: t.unlock_time ?? 0,
		locked: t.locked ?? false,
		doubleSpend: t.double_spend_seen ?? false,
		note: t.note,
		paymentId: t.payment_id ?? '',
		destinations: dests,
		subaddrIndices,
	}
}

export async function getHeight(
	state: MoneroWalletState,
): Promise<number> {
	if (!state.wallet) throw new Error('Wallet RPC not started')
	const height = (await state.wallet.getHeight()) as number
	console.log(`[monero] wallet height: ${height}`)
	return height
}

export async function getFeeEstimate(
	state: MoneroWalletState,
): Promise<{ fee: string; fees: string[]; estimatedFee: string }> {
	try {
		const conn = new MoneroRpcConnection({
			uri: `http://${state.daemonAddress}`,
		})
		const res = await conn.sendJsonRequest('get_fee_estimate', {
			grace_blocks: 10,
		})
		if (res?.error) throw new Error(res.error.message)
		console.log('[rpc][get_fee_estimate][response]', res)
		const result = res?.result
		const txSizeKb = 2.5
		const feePerKb = BigInt(result.fee ?? '0')
		const fees = (result.fees ?? []).map((f: string) =>
			BigInt(f).toString(),
		)
		const estimated =
			(feePerKb * BigInt(Math.round(txSizeKb * 10))) / 10n
		return {
			fee: feePerKb.toString(),
			fees,
			estimatedFee: estimated.toString(),
		}
	} catch (e) {
		console.log('[monero] getFeeEstimate error:', e)
		return { fee: '0', fees: ['0', '0', '0', '0'], estimatedFee: '0' }
	}
}

export async function getDaemonHeight(
	state: MoneroWalletState,
): Promise<number> {
	if (!state.wallet) throw new Error('Wallet RPC not started')
	try {
		const daemon = await connectToDaemonRpc(
			`http://${state.daemonAddress}`,
		)
		const height = (await daemon.getHeight()) as number
		console.log(`[monero] daemon height: ${height}`)
		return height
	} catch (e) {
		console.log(`[monero] failed to get daemon height:`, e)
		return 0
	}
}

export async function sweepAll(
	state: MoneroWalletState,
	address: string,
	priority: number = 0,
	accountIndex: number = 0,
): Promise<{ txHash: string; fee: string; amount: string }> {
	if (!state.wallet) throw new Error('Wallet RPC not started')
	console.log(
		`[monero] sweepAll: ${address} priority=${priority} account=${accountIndex}`,
	)
	const result = await rawRpc(state, 'sweep_all', {
		address,
		priority,
		account_index: accountIndex,
		get_tx_keys: true,
		get_tx_hex: false,
		get_tx_metadata: false,
	})
	const txHash = result.tx_hash_list?.[0] ?? ''
	const fee = result.fee_list?.[0]?.toString() ?? '0'
	const amount = result.amount_list?.[0]?.toString() ?? '0'
	console.log(
		`[monero] sweepAll result: tx_hash=${txHash} fee=${fee} amount=${amount}`,
	)
	return { txHash, fee, amount }
}

export async function transfer(
	state: MoneroWalletState,
	address: string,
	amount: bigint,
	priority: number = 0,
	accountIndex: number = 0,
): Promise<{ txHash: string; fee: string; amount: string }> {
	if (!state.wallet) throw new Error('Wallet RPC not started')
	console.log(
		`[monero] transfer: ${address} amount=${amount.toString()} priority=${priority} account=${accountIndex}`,
	)
	const result = await rawRpc(state, 'transfer', {
		destinations: [{ address, amount: amount.toString() }],
		priority,
		account_index: accountIndex,
		get_tx_key: true,
		get_tx_hex: false,
		get_tx_metadata: false,
	})
	console.log(
		`[monero] transfer result: tx_hash=${result.tx_hash} fee=${result.fee} amount=${result.amount}`,
	)
	return {
		txHash: result.tx_hash,
		fee: result.fee?.toString() ?? '0',
		amount: result.amount?.toString() ?? amount.toString(),
	}
}

export function listWallets(): string[] {
	const dir = getWalletDir()
	if (!existsSync(dir)) return []
	return readdirSync(dir)
		.filter((f) => f.endsWith('.keys'))
		.map((f) => f.replace(/\.keys$/, ''))
}

export async function isWalletOpen(
	state: MoneroWalletState,
): Promise<boolean> {
	if (!state.wallet) return false
	try {
		await state.wallet.getHeight()
		return true
	} catch {
		return false
	}
}

export async function isConnected(
	state: MoneroWalletState,
): Promise<boolean> {
	if (!state.wallet) return false
	try {
		const daemon = await connectToDaemonRpc(
			`http://${state.daemonAddress}`,
		)
		await daemon.getHeight()
		return true
	} catch (e) {
		console.log(`[monero] connection check failed:`, e)
		return false
	}
}
