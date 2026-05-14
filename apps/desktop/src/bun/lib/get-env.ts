const env = Bun.env.ELECTROBUN_ENV as 'dev' | 'prod' | undefined

export const getENV = () => {
	let appName
	let dbFilename
	if (env === 'prod') {
		appName = 'koins'
		dbFilename = 'koins.db'
	} else {
		appName = 'koins-dev'
		dbFilename = 'koins-dev.db'
	}

	return {
		env: env || 'dev',
		appName,
		dbFilename,
	}
}
