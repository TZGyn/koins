<script lang="ts">
	import { evmWallet as wallet } from '$lib/states/evm-wallet.svelte.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from '$lib/components/ui/card/index.js'
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
							await w.login('multi')
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
							await w.login('monero')
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
