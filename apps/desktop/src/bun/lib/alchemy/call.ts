import { tryCatch } from '@koins/utils'

const TIMEOUT = 15_000

export const post = async <T>(
	url: string,
	body: any,
): Promise<{ jsonrpc: '2.0'; id: number; result: T }> => {
	const [response, error] = await tryCatch(
		fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(TIMEOUT),
		}),
	)

	if (error) {
		console.log(error)
		throw error
	}

	const [data, dataError] = await tryCatch(response.json())

	if (dataError) {
		console.log(dataError)
		throw dataError
	}

	return data
}
