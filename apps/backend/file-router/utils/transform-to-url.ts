// https://github.com/wobsoriano/elysia-autoroutes/blob/main/src/utils/transformPathToUrl.ts#L4C31-L4C31
export function transformToUrl(path: string) {
	return (
		path
			// Clean the url extensions
			.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/u, '')
			// Fix windows slashes
			.replaceAll('\\', '/')
			// Handle wild card based routes - users/[...id]/profile.ts -> users/*/profile
			.replaceAll(/\[\.\.\..*\]/gu, '*')
			// Handle generic square bracket based routes - users/[id]/index.ts -> users/:id
			.replaceAll(
				/\[(.*?)\]/gu,
				(_: string, match: string) => `:${match}`,
			)
			.replace(/\/?\((.*)\)/, '')
			// Handle the case when multiple parameters are present in one file
			// users / [id] - [name].ts to users /: id -:name and users / [id] - [name] / [age].ts to users /: id -: name /: age
			.replaceAll(']-[', '-:')
			.replaceAll(']/', '/')
			.replaceAll(/\[|\]/gu, '')
			// remove potential route methods in file name
			.replace(
				/(\.(?<method>connect|delete|get|head|options|patch|post|put|trace))?(\.(?<env>dev|prod|prerender))?$/,
				'',
			)
			// remove index from end of path
			.replace(/\/?index$/, '')
	)
}
