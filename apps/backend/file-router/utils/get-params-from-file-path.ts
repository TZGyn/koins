export const getParamsFromFilePath = (path: string) => {
	const params = path.match(/\[(.*?)\]/gu) || []
	return params.map((param) => {
		return param.replaceAll(
			/\[(.*?)\]/gu,
			(_: string, match: string) => `${match}`,
		)
	})
}
