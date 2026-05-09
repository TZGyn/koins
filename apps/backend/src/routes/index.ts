import { betterAuth } from '$lib/plugin/better-auth'
import Elysia from 'elysia'

export const route = new Elysia()
	.use(betterAuth)
	.get('/', async () => {
		return 'hello'
	})
