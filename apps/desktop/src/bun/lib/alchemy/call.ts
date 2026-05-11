import { tryCatch } from '@koins/utils'

export const post = async <T>(
	url: string,
	body: any,
): Promise<{ jsonrpc: '2.0'; id: number; result: T }> => {
	const [response, error] = await tryCatch(
		fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		}),
	)

	if (error) {
		console.log(error)
		throw error
	}

	console.log('data', await response.text())

	const [data, dataError] = await tryCatch(response.json())

	if (dataError) {
		console.log(dataError)
		throw dataError
	}

	return data
}
