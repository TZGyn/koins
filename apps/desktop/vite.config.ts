import tailwindcss from '@tailwindcss/vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { router } from 'sv-router/vite-plugin'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'url'

export default defineConfig({
	plugins: [tailwindcss(), svelte(), router()],
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
		},
	},
})
