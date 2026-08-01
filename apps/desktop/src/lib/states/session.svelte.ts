import { electrobun } from '$lib/electrobun'

let unlocked = $state(false)
let biometricAvailable = $state(false)
let unlocking = $state(false)
let error = $state('')

const checkBiometric = async () => {
	if (!electrobun.rpc) return
	try {
		biometricAvailable = await electrobun.rpc.request.biometricCanAuth({})
	} catch { /* ignore */ }
}

const unlock = async (): Promise<boolean> => {
	if (!electrobun.rpc) return false
	unlocking = true
	error = ''
	try {
		const ok = await electrobun.rpc.request.biometricAuth({
			reason: 'Unlock Koins',
		})
		if (ok) {
			unlocked = true
		} else {
			error = 'Authentication failed'
		}
		return ok
	} catch (e) {
		error = e instanceof Error ? e.message : 'Unlock failed'
		return false
	} finally {
		unlocking = false
	}
}

const lock = () => {
	unlocked = false
	error = ''
}

checkBiometric()

export const session = {
	get unlocked() {
		return unlocked
	},
	get biometricAvailable() {
		return biometricAvailable
	},
	get unlocking() {
		return unlocking
	},
	get error() {
		return error
	},
	unlock,
	lock,
}