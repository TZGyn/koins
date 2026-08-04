import jsQR from 'jsqr'

export const decodeQrFromFile = (file: File): Promise<string> =>
	new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file)
		const img = new Image()
		img.onload = () => {
			try {
				const canvas = document.createElement('canvas')
				canvas.width = img.naturalWidth
				canvas.height = img.naturalHeight
				const ctx = canvas.getContext('2d')
				if (!ctx) throw new Error('Canvas is not supported')
				ctx.drawImage(img, 0, 0)
				const { data, width, height } = ctx.getImageData(
					0,
					0,
					canvas.width,
					canvas.height,
				)
				resolve(jsQR(data, width, height)?.data ?? '')
			} catch (e) {
				reject(e)
			} finally {
				URL.revokeObjectURL(url)
			}
		}
		img.onerror = () => {
			URL.revokeObjectURL(url)
			reject(new Error('Could not load the image'))
		}
		img.src = url
	})

export type QrParseResult = {
	address: string
	amount?: string
	destinationTag?: string
}

// Handles payment URIs (monero:ADDRESS?tx_amount=..., xrp:rADDR?amount=..&dt=..)
// as well as bare addresses. Returns the last path-like segment before any
// query string so prefixes and /pay paths are skipped.
export const parseQrPayload = (
	text: string,
	kind: 'xrp' | 'monero',
): QrParseResult => {
	let body = text.trim().replace(/\s+/g, '')
	body = body.replace(/^(?:[a-z0-9+.-]+):\/?\//i, '')
	const [beforeQuery, queryRaw] = body.split('?')
	const segments = beforeQuery.split('/')
	const address = segments[segments.length - 1]

	const params: Record<string, string> = {}
	if (queryRaw) {
		for (const pair of queryRaw.split('&')) {
			const eq = pair.indexOf('=')
			const key = (eq >= 0 ? pair.slice(0, eq) : pair).toLowerCase()
			const value = eq >= 0 ? decodeURIComponent(pair.slice(eq + 1)) : ''
			if (key) params[key] = value
		}
	}

	if (kind === 'xrp') {
		return {
			address,
			amount: params['amount'] || undefined,
			destinationTag: params['dt'] || undefined,
		}
	}
	return {
		address,
		amount: params['tx_amount'] || undefined,
	}
}