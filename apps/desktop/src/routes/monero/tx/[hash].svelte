<script lang="ts">
	import { electrobun, type MoneroTransferDetails } from '$lib/electrobun.js'
	import { atomicToXmr } from '$lib/states/monero-wallet.svelte.js'
	import { navigate, route } from 'sv-router/generated'
	import { Button } from '$lib/components/ui/button/index.js'
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
	} from '$lib/components/ui/card/index.js'
	import ArrowDown from '@lucide/svelte/icons/arrow-down'
	import ArrowUp from '@lucide/svelte/icons/arrow-up'

	let details = $state<MoneroTransferDetails | null>(null)
	let loading = $state(true)
	let error = $state('')

	const hash = $derived(route.params.hash)

	$effect(() => {
		if (!hash) return
		loading = true
		error = ''
		electrobun.rpc?.request
			.moneroGetTransferDetails({ txid: hash })
			.then((res) => {
				details = res
				loading = false
			})
			.catch((e) => {
				error = e instanceof Error ? e.message : 'Failed to fetch details'
				loading = false
			})
	})
</script>

<div class="mx-auto mt-16 max-w-md">
	<Button
		variant="outline"
		size="sm"
		onclick={() => navigate('/monero')}
		class="mb-4">
		&larr; Back
	</Button>

	<Card>
		<CardHeader>
			<CardTitle>Transaction Details</CardTitle>
		</CardHeader>
		<CardContent>
			{#if loading}
				<p class="text-muted-foreground text-xs">Loading...</p>
			{:else if error}
				<p class="text-red-500 text-xs">{error}</p>
			{:else if details}
				<div class="space-y-2 font-mono text-xs">
					<div class="flex items-center gap-2 rounded-md bg-muted p-2">
						<div class="shrink-0 {details.direction === 'in' ? 'text-green-500' : 'text-muted-foreground'}">
							{#if details.direction === 'in'}
								<ArrowDown size={16} />
							{:else}
								<ArrowUp size={16} />
							{/if}
						</div>
						<p class="font-medium">
							{details.direction === 'in' ? 'Received' : 'Sent'}
						</p>
					</div>

					<div class="rounded-md bg-muted p-2">
						<p class="text-muted-foreground mb-0.5">Transaction Hash</p>
						<p class="break-all">{details.hash}</p>
					</div>

					<div class="grid grid-cols-2 gap-2">
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Amount</p>
							<p>{atomicToXmr(details.amount)} XMR</p>
						</div>
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Fee</p>
							<p>{atomicToXmr(details.fee)} XMR</p>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-2">
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Height</p>
							<p>{details.height.toLocaleString()}</p>
						</div>
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Confirmations</p>
							<p>{details.confirmations.toLocaleString()}</p>
						</div>
					</div>

					{#if details.timestamp && details.timestamp !== '0'}
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Date</p>
							<p>{new Date(Number(details.timestamp) * 1000).toLocaleString()}</p>
						</div>
					{/if}

					{#if details.direction === 'out' && details.destinations.length > 0}
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Destinations</p>
							{#each details.destinations as dest}
								<p class="break-all text-muted-foreground/70">{dest.address}</p>
								<p class="text-muted-foreground">{atomicToXmr(dest.amount)} XMR</p>
							{/each}
						</div>
					{/if}

					<div class="grid grid-cols-2 gap-2">
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Locked</p>
							<p>{details.locked ? 'Yes' : 'No'}</p>
						</div>
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Double Spend</p>
							<p>{details.doubleSpend ? 'Yes' : 'No'}</p>
						</div>
					</div>

					{#if details.note}
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Note</p>
							<p>{details.note}</p>
						</div>
					{/if}

					{#if details.paymentId}
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Payment ID</p>
							<p class="break-all">{details.paymentId}</p>
						</div>
					{/if}
				</div>
				<div class="mt-4">
					<Button
						variant="outline"
						size="sm"
						class="w-full"
						onclick={() =>
							electrobun.rpc?.request.openExternal({
								url: `https://moneroblocks.info/tx/${details.hash}`,
							})}>
						View on Explorer
					</Button>
				</div>
			{:else}
				<p class="text-muted-foreground text-xs">No details available</p>
			{/if}
		</CardContent>
	</Card>
</div>
