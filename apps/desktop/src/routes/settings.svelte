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
	import ArrowLeft from '@lucide/svelte/icons/arrow-left'
	import Trash2 from '@lucide/svelte/icons/trash-2'
	import WalletIcon from '@lucide/svelte/icons/wallet'

	const w = wallet
	let confirm = $state(false)
	let resetting = $state(false)
	let deletingWalletId = $state<string | null>(null)
	let flushing = $state(false)

	async function handleReset() {
		resetting = true
		const ok = await w.resetApp()
		if (ok) navigate('/')
		resetting = false
		confirm = false
	}

	async function handleDeleteWallet(id: string) {
		await w.deleteWallet(id)
		deletingWalletId = null
		if (w.wallets.length === 0) navigate('/multicoin')
	}

	async function handleFlushCache() {
		flushing = true
		await w.flushTxCache()
		flushing = false
	}
</script>

<div class="mx-auto mt-16 max-w-md">
	<div class="flex flex-col gap-4">
		<div class="flex items-center gap-2">
			<Button variant="outline" size="sm" onclick={() => navigate('/multicoin')}>
				<ArrowLeft size={16} />
				Back
			</Button>
		</div>
		{#if w.wallets.length > 0}
			<Card>
				<CardHeader>
					<CardTitle>Wallets</CardTitle>
					<CardDescription>Manage your EVM wallets</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="flex flex-col gap-2">
						{#each w.wallets as wal}
							<div class="flex items-center gap-3 rounded-md border border-input p-3">
								<WalletIcon size={18} class="shrink-0 text-muted-foreground" />
								<div class="flex-1 min-w-0">
									<p class="font-medium text-sm">{wal.name}</p>
									<p class="text-xs text-muted-foreground">
										Created {new Date(wal.createdAt).toLocaleDateString()}
									</p>
								</div>
								{#if deletingWalletId === wal.id}
									<div class="flex items-center gap-1.5">
										<Button size="sm" variant="destructive" onclick={() => handleDeleteWallet(wal.id)}>
											Delete
										</Button>
										<Button size="sm" variant="outline" onclick={() => (deletingWalletId = null)}>
											Cancel
										</Button>
									</div>
								{:else}
									<Button size="sm" variant="outline" onclick={() => (deletingWalletId = wal.id)}>
										<Trash2 size={14} />
									</Button>
								{/if}
							</div>
						{/each}
					</div>
				</CardContent>
			</Card>
		{/if}
		<Card>
			<CardHeader>
				<CardTitle>Settings</CardTitle>
				<CardDescription>App preferences and data management</CardDescription>
			</CardHeader>
			<CardContent class="space-y-4">
				<div>
					<p class="font-medium text-xs">Transaction Cache</p>
					<p class="text-muted-foreground text-xs mt-1">
						Clears all cached transaction history and sync status. Data will be re-fetched from Alchemy on next refresh.
					</p>
					<div class="mt-3">
						<Button variant="outline" onclick={handleFlushCache} disabled={flushing}>
							{flushing ? 'Flushing...' : 'Flush Transaction Cache'}
						</Button>
					</div>
				</div>
				<div>
					<p class="font-medium text-xs">Reset App</p>
					<p class="text-muted-foreground text-xs mt-1">
						Removes your seed, API key, and all cached data from the keychain
						and database. You can then set up the wallet fresh.
					</p>
					<div class="mt-3">
						{#if confirm}
							<div class="flex gap-2 items-center">
								<p class="text-xs text-red-500">Are you sure?</p>
								<Button size="sm" variant="destructive" onclick={handleReset} disabled={resetting}>
									{resetting ? 'Resetting...' : 'Yes, reset everything'}
								</Button>
								<Button size="sm" variant="outline" onclick={() => (confirm = false)}>
									Cancel
								</Button>
							</div>
						{:else}
							<Button variant="outline" onclick={() => (confirm = true)}>
								Reset App
							</Button>
						{/if}
					</div>
				</div>
			</CardContent>
		</Card>
	</div>
</div>
