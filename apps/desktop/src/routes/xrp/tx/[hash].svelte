<script lang="ts">
	import { electrobun, type XrpTxDetails } from '$lib/electrobun.js'
	import { xrpWallet, xrpNetwork } from '$lib/states/xrp-wallet.svelte.js'
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

	let details = $state<XrpTxDetails | null>(null)
	let loading = $state(true)
	let error = $state('')

	const hash = $derived(route.params.hash)

	$effect(() => {
		if (!hash) return
		loading = true
		error = ''
		electrobun.rpc?.request
			.xrpGetTxDetails({ hash })
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

<div class="mx-auto max-w-lg">
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
						<div class="shrink-0 {details.to === xrpWallet.address ? 'text-green-500' : 'text-muted-foreground'}">
							{#if details.to === xrpWallet.address}
								<ArrowDown size={16} />
							{:else}
								<ArrowUp size={16} />
							{/if}
						</div>
						<p class="font-medium">
							{details.to === xrpWallet.address ? 'Received' : 'Sent'}
						</p>
					</div>

					<div class="rounded-md bg-muted p-2">
						<p class="text-muted-foreground mb-0.5">Transaction Hash</p>
						<p class="break-all">{details.hash}</p>
					</div>

					<div class="rounded-md bg-muted p-2">
						<p class="text-muted-foreground mb-0.5">From</p>
						<p class="break-all">{details.from}</p>
					</div>

					<div class="rounded-md bg-muted p-2">
						<p class="text-muted-foreground mb-0.5">To</p>
						<p class="break-all">{details.to}</p>
					</div>

					<div class="grid grid-cols-2 gap-2">
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Amount</p>
							<p>{details.amount} XRP</p>
						</div>
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Fee</p>
							<p>{details.fee} XRP</p>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-2">
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Ledger</p>
							<p>{details.ledgerIndex.toLocaleString()}</p>
						</div>
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Validated</p>
							<p>{details.confirmed ? 'Yes' : 'No'}</p>
						</div>
					</div>

					{#if details.destinationTag !== undefined}
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Destination Tag</p>
							<p>{details.destinationTag}</p>
						</div>
					{/if}

					{#if details.timestamp && details.timestamp !== '0'}
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Date</p>
							<p>{new Date(Number(details.timestamp) * 1000).toLocaleString()}</p>
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
								url: `${xrpNetwork.explorerUrl}${details?.hash}`,
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
