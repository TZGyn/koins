import { JsonRpcProvider, HDNodeWallet, formatEther } from 'ethers'
import { electrobun } from '$lib/electrobun'

const BNB_RPC = 'https://bsc-dataseed.binance.org'

export const Wallet = () => {
	let seed = $state('')
	let address = $state('')
	let balance = $state('0')
	let loading = $state(false)
	let error = $state('')
	let vaultExists = $state(false)
	let ready = $state(false)

	const init = async () => {
		try {
			const raw = await electrobun.rpc?.request.getSecret({
				service: 'koins',
				name: 'vault',
			})
			vaultExists = raw !== null && raw !== undefined
			if (raw) {
				seed = raw
				await refresh()
			}
		} catch (e) {
			console.log(e)
			error =
				e instanceof Error ? e.message : 'Failed to access keychain'
		} finally {
			ready = true
		}
	}

	const saveVault = async (phrase: string) => {
		loading = true
		error = ''
		try {
			HDNodeWallet.fromPhrase(phrase.trim())
			await electrobun.rpc?.request.setSecret({
				service: 'koins',
				name: 'vault',
				value: phrase.trim(),
			})
			seed = phrase.trim()
			vaultExists = true
			await refresh()
		} catch (e) {
			error = e instanceof Error ? e.message : 'Invalid seed phrase'
		} finally {
			loading = false
		}
	}

	const lock = () => {
		seed = ''
		address = ''
		balance = '0'
		error = ''
	}

	const refresh = async () => {
		if (!seed) return
		loading = true
		error = ''
		try {
			const wallet = HDNodeWallet.fromPhrase(seed)
			address = wallet.address
			const provider = new JsonRpcProvider(BNB_RPC)
			const bal = await provider.getBalance(wallet.address)
			balance = formatEther(bal)
		} catch (e) {
			error =
				e instanceof Error ? e.message : 'Failed to fetch balance'
		} finally {
			loading = false
		}
	}

	return {
		get isLocked() {
			return vaultExists && !seed
		},
		get seed() {
			return seed
		},
		get address() {
			return address
		},
		get balance() {
			return balance
		},
		get loading() {
			return loading
		},
		get error() {
			return error
		},
		get vaultExists() {
			return vaultExists
		},
		get ready() {
			return ready
		},
		refresh,
		init,
		lock,
		saveVault,
	}
}
