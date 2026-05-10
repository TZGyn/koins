<script lang="ts">
	import { Wallet } from '$lib/states/wallet.svelte.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import { Textarea } from '$lib/components/ui/textarea/index.js'
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from '$lib/components/ui/card/index.js'

	let w = Wallet()
	let inputSeed = $state('')

	$effect(() => {
		w.init()
	})
</script>

<div class="mx-auto mt-16 max-w-md">
	{#if !w.ready}
		<!-- loading -->
	{:else if !w.vaultExists}
		<Card>
			<CardHeader>
				<CardTitle>Import Wallet</CardTitle>
				<CardDescription>
					Enter your seed phrase to save it securely in your system
					keychain
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="flex flex-col gap-3">
					<Textarea
						placeholder="Enter your 12 or 24 word seed phrase"
						bind:value={inputSeed} />
					<Button
						onclick={() => w.saveVault(inputSeed)}
						disabled={w.loading || !inputSeed.trim()}>
						{w.loading ? 'Saving...' : 'Save to Keychain'}
					</Button>
				</div>
				{#if w.error}
					<p class="mt-3 text-red-500">{w.error}</p>
				{/if}
			</CardContent>
		</Card>
	{:else if w.isLocked}
		<Card>
			<CardContent>
				<p class="text-muted-foreground text-xs">Unlocking...</p>
			</CardContent>
		</Card>
	{:else}
		<Card>
			<CardHeader>
				<CardTitle>Wallet</CardTitle>
				<CardDescription>Your wallet is unlocked</CardDescription>
			</CardHeader>
			<CardContent>
				{#if w.address}
					<div class="mb-4 space-y-1">
						<p class="font-medium text-xs">Address</p>
						<p class="font-mono text-xs break-all">{w.address}</p>
						<p class="mt-2 font-medium text-xs">BNB Balance</p>
						<p class="font-mono text-lg">{w.balance} BNB</p>
					</div>
				{/if}

				{#if w.error}
					<p class="mb-3 text-red-500">{w.error}</p>
				{/if}

				<div class="flex gap-2">
					<Button onclick={() => w.refresh()} disabled={w.loading}>
						{w.loading ? 'Refreshing...' : 'Refresh Balance'}
					</Button>
					<Button variant="outline" onclick={() => w.lock()}>
						Lock
					</Button>
				</div>
			</CardContent>
		</Card>
	{/if}
</div>
