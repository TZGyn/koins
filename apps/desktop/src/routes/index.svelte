<script lang="ts">
	import { evmWallet as wallet } from '$lib/states/evm-wallet.svelte.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card/index.js'
	import { navigate } from 'sv-router/generated'

	const w = wallet

	let initStarted = false
	$effect(() => {
		if (!initStarted) {
			initStarted = true
			w.init()
		}
	})
</script>

<div class="mx-auto mt-24 max-w-sm">
	{#if !w.ready}
		<p class="text-center text-muted-foreground text-sm">Loading...</p>
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
				<CardDescription>Choose an account type to get started</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="flex flex-col gap-3">
					<Button
						onclick={async () => { await w.login('multi'); navigate('/multicoin') }}
						class="w-full">
						EVM (ETH / BSC / Polygon)
					</Button>
					<Button
						onclick={async () => { await w.login('monero'); navigate('/monero') }}
						variant="outline"
						class="w-full">
						Monero
					</Button>
				</div>
			</CardContent>
		</Card>
	{/if}
</div>
