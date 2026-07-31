<script lang="ts">
	import { moneroWallet } from '$lib/states/monero-wallet.svelte.js'
	import { xrpWallet } from '$lib/states/xrp-wallet.svelte.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from '$lib/components/ui/card/index.js'
	import { navigate } from 'sv-router/generated'
	import { onMount } from 'svelte'
	import { frontendLog, frontendLogError } from '$lib/electrobun.js'

	let feError = $state<string | null>(null)

	onMount(() => {
		frontendLog('index.svelte mounted')
		moneroWallet.init().catch((e) => frontendLogError('moneroWallet.init() failed', e))
		xrpWallet.init().catch((e) => frontendLogError('xrpWallet.init() failed', e))
	})

	$effect(() => {
		if (moneroWallet.accountType === 'monero') {
			navigate('/monero')
		} else if (xrpWallet.accountType === 'xrp') {
			navigate('/xrp')
		}
	})

	$effect(() => {
		if (typeof window !== 'undefined') {
			const handler = (event: ErrorEvent) => {
				const msg = event.error?.stack || event.error?.message || event.message || 'unknown error'
				feError = msg
				frontendLogError('uncaught error', msg)
			}
			const rejectHandler = (event: PromiseRejectionEvent) => {
				const msg = event.reason?.stack || event.reason?.message || String(event.reason || 'unknown')
				feError = msg
				frontendLogError('unhandled rejection', msg)
			}
			window.addEventListener('error', handler)
			window.addEventListener('unhandledrejection', rejectHandler)
			return () => {
				window.removeEventListener('error', handler)
				window.removeEventListener('unhandledrejection', rejectHandler)
			}
		}
	})
</script>

{#if feError}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-8">
		<div class="max-w-lg rounded-lg border border-destructive/50 bg-destructive/10 p-6">
			<p class="font-bold text-destructive text-sm mb-2">Frontend Error</p>
			<pre class="whitespace-pre-wrap font-mono text-xs text-destructive/80 max-h-96 overflow-y-auto">{feError}</pre>
		</div>
	</div>
{/if}

<div class="mx-auto mt-24 max-w-sm">
	<Card>
		<CardHeader class="text-center">
			<CardTitle>Welcome</CardTitle>
			<CardDescription>
				Choose an account type to get started
			</CardDescription>
		</CardHeader>
		<CardContent>
			<div class="flex flex-col gap-3">
				<Button
					onclick={async () => {
						await moneroWallet.login()
						navigate('/monero')
					}}
					variant="outline"
					class="w-full">
					<img
						src="/icons/monero.png"
						alt=""
						class="-ml-1 mr-1.5 inline-block size-5 rounded-full align-middle" />
					Monero
				</Button>
				<Button
					onclick={async () => {
						await xrpWallet.login()
						navigate('/xrp')
					}}
					variant="outline"
					class="w-full">
					<img
						src="/icons/xrp.png"
						alt=""
						class="-ml-1 mr-1.5 inline-block size-5 rounded-full align-middle" />
					XRP
				</Button>
			</div>
		</CardContent>
	</Card>
</div>
