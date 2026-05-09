import { PUBLIC_API_URL } from '$env/static/public'
import { usernameClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/svelte'

export const authClient = createAuthClient({
	baseURL: PUBLIC_API_URL, // The base URL of your auth server
	basePath: '/auth',
	plugins: [usernameClient()],
})
