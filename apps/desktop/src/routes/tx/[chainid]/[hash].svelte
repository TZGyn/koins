<script lang="ts">
	import {
		electrobun,
		type TransactionDetails,
	} from '$lib/electrobun.js'
	import { networks } from '$lib/states/wallet.svelte.js'
	import { navigate, route } from 'sv-router/generated'
	import { Button } from '$lib/components/ui/button/index.js'
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
	} from '$lib/components/ui/card/index.js'

	let details = $state<TransactionDetails | null>(null)
	let loading = $state(true)
	let error = $state('')

	const chainid = $derived(route.params.chainid)
	const hash = $derived(route.params.hash)

	const network = $derived(
		networks.find((n) => n.chainid === chainid),
	)

	$effect(() => {
		if (!hash || !chainid) return
		loading = true
		error = ''
		electrobun.rpc?.request
			.fetchTransactionDetails({ hash, chainid })
			.then((res) => {
				details = res
				loading = false
			})
			.catch((e) => {
				error =
					e instanceof Error ? e.message : 'Failed to fetch details'
				loading = false
			})
	})

	function explorerUrl() {
		if (!network) return ''
		return network.explorerUrl + hash
	}
</script>

<div class="mx-auto mt-16 max-w-md">
	<Button
		variant="outline"
		size="sm"
		onclick={() => navigate('/')}
		class="mb-4">
		&larr; Back
	</Button>

	<Card>
		<CardHeader>
			<div class="flex items-center justify-between">
				<CardTitle>Transaction Details</CardTitle>
				{#if network}
					<span
						class="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
						{network.name}
					</span>
				{/if}
			</div>
		</CardHeader>
		<CardContent>
			{#if loading}
				<p class="text-muted-foreground text-xs">Loading...</p>
			{:else if error}
				<p class="text-red-500 text-xs">{error}</p>
			{:else if details}
				<div class="space-y-2 font-mono text-xs">
					<div class="rounded-md bg-muted p-2">
						<p class="text-muted-foreground mb-0.5">Hash</p>
						<p class="break-all">{details.hash}</p>
					</div>
					<div class="grid grid-cols-2 gap-2">
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Status</p>
							<p
								class={details.status === 'success'
									? 'text-green-500'
									: 'text-red-500'}>
								{details.status}
							</p>
						</div>
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Block</p>
							<p>{details.blockNumber ?? 'N/A'}</p>
						</div>
					</div>
					<div class="rounded-md bg-muted p-2">
						<p class="text-muted-foreground mb-0.5">From</p>
						<p class="break-all">{details.from}</p>
					</div>
					<div class="rounded-md bg-muted p-2">
						<p class="text-muted-foreground mb-0.5">To</p>
						<p class="break-all">{details.to ?? 'N/A'}</p>
					</div>
					<div class="rounded-md bg-muted p-2">
						<p class="text-muted-foreground mb-0.5">
							Value ({network?.symbol ?? 'ETH'})
						</p>
						<p>{details.value}</p>
					</div>
					<div class="grid grid-cols-2 gap-2">
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">
								Tx Fee ({network?.symbol ?? 'ETH'})
							</p>
							<p>{details.fee}</p>
						</div>
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">
								Gas Price (Gwei)
							</p>
							<p>{details.gasPrice}</p>
						</div>
					</div>
					<div class="grid grid-cols-2 gap-2">
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Nonce</p>
							<p>{details.nonce}</p>
						</div>
						<div class="rounded-md bg-muted p-2">
							<p class="text-muted-foreground mb-0.5">Type</p>
							<p>{details.type}</p>
						</div>
					</div>
	
				</div>
				<div class="mt-4">
					<Button
						variant="outline"
						size="sm"
						class="w-full"
						onclick={() =>
							electrobun.rpc?.request.openExternal({
								url: explorerUrl(),
							})}>
						View on Explorer
					</Button>
				</div>
			{:else}
				<p class="text-muted-foreground text-xs">
					No details available
				</p>
			{/if}
		</CardContent>
	</Card>
</div>
