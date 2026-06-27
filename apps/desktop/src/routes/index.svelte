<script lang="ts">
	import { evmWallet as wallet } from '$lib/states/evm-wallet.svelte.js'
	import { moneroWallet } from '$lib/states/monero-wallet.svelte.js'
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

	const w = wallet

	let feError = $state<string | null>(null)

	onMount(() => {
		frontendLog('index.svelte mounted')
		w.init().catch((e) => frontendLogError('w.init() failed', e))
		moneroWallet.init().catch((e) => frontendLogError('moneroWallet.init() failed', e))
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
	{#if !w.ready}
		<p class="text-center text-muted-foreground text-sm">
			Loading...
		</p>
	{:else if w.accountType}
		{#if w.accountType === 'multi'}
			{navigate('/multicoin')}
		{:else}
			{navigate('/monero')}
		{/if}
	{:else}
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
							await w.login()
							navigate('/multicoin')
						}}
						class="w-full">
						<span class="-ml-1 mr-2 flex items-center">
							<img
								src="/icons/ethereum.png"
								alt=""
								class="relative z-30 size-5 rounded-full ring-2 ring-accent" />
							<img
								src="/icons/binance.png"
								alt=""
								class="-ml-1.5 relative z-20 size-5 rounded-full ring-2 ring-accent" />
							<img
								src="/icons/polygon.png"
								alt=""
								class="-ml-1.5 relative z-10 size-5 rounded-full ring-2 ring-accent" />
						</span>
					</Button>
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
					</Button>
				</div>
			</CardContent>
		</Card>
	{/if}
</div>
