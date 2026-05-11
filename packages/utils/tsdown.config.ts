import { defineConfig } from 'tsdown'

export default defineConfig({
	entry: ['src/index.ts'],
	platform: 'neutral',
	clean: false,
	dts: true,
	ignoreWatch: ['./.turbo'],
})
