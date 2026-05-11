export const randomNumber = (maxNumber: number | undefined) => {
	let randomNumberString
	switch (maxNumber) {
		case 1:
			randomNumberString = Math.floor(getRandomInt(1, 9)).toString()
			break
		case 2:
			randomNumberString = Math.floor(getRandomInt(10, 90)).toString()
			break
		case 3:
			randomNumberString = Math.floor(
				getRandomInt(100, 900),
			).toString()
			break
		case 4:
			randomNumberString = Math.floor(
				getRandomInt(1000, 9000),
			).toString()
			break
		case 5:
			randomNumberString = Math.floor(
				getRandomInt(10000, 90000),
			).toString()
			break
		case 6:
			randomNumberString = Math.floor(
				getRandomInt(100000, 900000),
			).toString()
			break
		default:
			randomNumberString = ''
			break
	}
	return randomNumberString
}

const getRandomInt = (
	minInclusive: number,
	maxInclusive: number,
): number => {
	if (
		!Number.isFinite(minInclusive) ||
		!Number.isFinite(maxInclusive)
	) {
		throw new Error('Invalid bounds for getRandomInt')
	}
	if (maxInclusive < minInclusive) {
		throw new Error('maxInclusive must be >= minInclusive')
	}
	if (minInclusive === maxInclusive) return minInclusive

	const [rand] = getRandomValues(1)
	const range = maxInclusive - minInclusive + 1
	return minInclusive + (rand % range)
}

function getRandomValues(length: number): Uint32Array {
	const cryptoApi = getCrypto()
	if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
		const buffer = new Uint32Array(length)
		cryptoApi.getRandomValues(buffer)
		return buffer
	}
	const buffer = new Uint32Array(length)
	for (let i = 0; i < length; i++) {
		buffer[i] = nextFallback32()
	}
	return buffer
}
function getCrypto(): Crypto | undefined {
	const g =
		typeof globalThis !== 'undefined'
			? (globalThis as unknown as { crypto?: Crypto })
			: undefined
	return g && g.crypto ? (g.crypto as Crypto) : undefined
}

let fallbackSeed: number = (Date.now() ^ 0x9e3779b9) >>> 0

function nextFallback32(): number {
	// xorshift32 advancing persistent state
	fallbackSeed ^= fallbackSeed << 13
	fallbackSeed >>>= 0
	fallbackSeed ^= fallbackSeed >>> 17
	fallbackSeed >>>= 0
	fallbackSeed ^= fallbackSeed << 5
	fallbackSeed >>>= 0
	return fallbackSeed >>> 0
}
