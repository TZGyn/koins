const env = (Bun.env.ELECTROBUN_ENV as string) || 'dev'

console.log('ENV', env)

export const getENV = () => {
	let appName
	let dbFilename
	if (env === 'stable') {
		appName = 'koins'
		dbFilename = 'koins.db'
	} else {
		appName = 'koins-dev'
		dbFilename = 'koins-dev.db'
	}

	return {
		env,
		appName,
		dbFilename,
	}
}
