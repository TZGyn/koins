<script lang="ts">
	import { xrpWallet, xrpNetwork } from '$lib/states/xrp-wallet.svelte.js'
	import { electrobun } from '$lib/electrobun.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
	} from '$lib/components/ui/card/index.js'
	import ArrowDown from '@lucide/svelte/icons/arrow-down'
	import ArrowUp from '@lucide/svelte/icons/arrow-up'
	import QrCodeIcon from '@lucide/svelte/icons/qr-code'
	import ExternalLink from '@lucide/svelte/icons/external-link'
	import Send from '@lucide/svelte/icons/send'
	import Loader from '$lib/components/loader.svelte'
	import QrCode from '$lib/components/qr.svelte'
	import * as Dialog from '$lib/components/ui/dialog/index.js'
	import { CopyButton } from '$lib/components/ui/copy-button'
	import { navigate, route } from 'sv-router/generated'
	import { onMount } from 'svelte'

	const w = xrpWallet

	const walletId = $derived(route.params.id)

	let qrDialogOpen = $state(false)
	let autoRefreshTimer: ReturnType<typeof setInterval> | undefined = $state()

	$effect(() => {
		if (w.seed && !autoRefreshTimer) {
			autoRefreshTimer = setInterval(() => w.refresh(), 30000)
		} else if (!w.seed && autoRefreshTimer) {
			clearInterval(autoRefreshTimer)
			autoRefreshTimer = undefined
		}
		return () => {
			if (autoRefreshTimer) {
				clearInterval(autoRefreshTimer)
				autoRefreshTimer = undefined
			}
		}
	})

	onMount(() => {
		if (!w.seed || w.currentWalletId !== walletId) {
			navigate('/xrp')
			return
		}
		w.refresh()
	})
</script>

<div class="space-y-6">
	<div class="flex flex-col items-center py-2">
		{#if w.loadingBalance}
			<div class="h-12 w-40 rounded-lg bg-muted animate-pulse"></div>
		{:else}
			<p class="text-sm text-muted-foreground">Balance</p>
			<p class="mt-1 font-mono text-4xl font-semibold tabular-nums tracking-tight">
				{w.balance} <span class="text-muted-foreground text-2xl">XRP</span>
			</p>
			{#if w.price}
				<p class="mt-1 text-sm text-muted-foreground tabular-nums">
					≈ ${(parseFloat(w.balance) * parseFloat(w.price)).toLocaleString(undefined, {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					})}
				</p>
			{/if}
			{#if !w.funded}
				<p class="mt-2 text-xs text-muted-foreground">
					Account not activated — needs at least 10 XRP
				</p>
			{/if}
		{/if}
	</div>

	<div class="flex items-center justify-center">
		<Button onclick={() => navigate('/xrp/send')} class="gap-2">
			<Send size={16} />
			Send
		</Button>
	</div>

	<div class="mx-auto max-w-md">
		<div class="flex items-center justify-between rounded-lg border border-border px-4 py-3">
			<div class="min-w-0 flex-1">
				<p class="text-xs text-muted-foreground mb-0.5">Address</p>
				<p class="font-mono text-xs break-all">{w.address}</p>
			</div>
			<div class="flex shrink-0 gap-1 ml-2">
				<Dialog.Root bind:open={qrDialogOpen}>
					<Dialog.Trigger>
						<Button variant="ghost" size="icon-sm" class="text-muted-foreground" aria-label="QR code">
							<QrCodeIcon size={14} />
						</Button>
					</Dialog.Trigger>
					<Dialog.Content>
						<div class="flex flex-col items-center gap-3 py-4">
							<QrCode text={w.address} size={256} />
							<p class="font-mono text-xs break-all text-center max-w-64">{w.address}</p>
						</div>
					</Dialog.Content>
				</Dialog.Root>
				<CopyButton text={w.address} variant="ghost" size="icon-sm" class="text-muted-foreground" />
				<Button
					variant="ghost"
					size="icon-sm"
					class="text-muted-foreground"
					aria-label="View on explorer"
					onclick={() => electrobun.rpc?.request.openExternal({ url: w.explorerAddressUrl })}>
					<ExternalLink size={14} />
				</Button>
			</div>
		</div>
		{#if w.fee}
			<p class="mt-2 text-center text-xs text-muted-foreground">
				Network fee: ~{w.fee} XRP
			</p>
		{/if}
	</div>

	<Card>
		<CardHeader>
			<CardTitle class="text-sm">Transactions</CardTitle>
		</CardHeader>
		<CardContent>
			{#if w.loadingTransactions}
				<div class="flex justify-center py-8"><Loader /></div>
			{:else if w.transactions.length === 0}
				<p class="text-center text-sm text-muted-foreground py-8">No transactions yet</p>
			{:else}
				<div class="space-y-1">
					{#each w.transactions as tx}
						<button
							onclick={() => navigate('/xrp/tx/:hash', { params: { hash: tx.hash } })}
							class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted transition-colors">
							<div class="flex size-8 shrink-0 items-center justify-center rounded-full {tx.direction === 'in' ? 'bg-muted' : 'bg-muted'}">
								<div class={tx.direction === 'in' ? 'text-green-500' : 'text-muted-foreground'}>
									{#if tx.direction === 'in'}
										<ArrowDown size={16} />
									{:else}
										<ArrowUp size={16} />
									{/if}
								</div>
							</div>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium">
									{tx.direction === 'in' ? 'Received' : 'Sent'}
									{#if !tx.confirmed}
										<span class="text-muted-foreground text-xs ml-1">(unconfirmed)</span>
									{/if}
								</p>
								<p class="text-xs text-muted-foreground">
									{#if tx.timestamp && tx.timestamp !== '0'}
										{new Date(Number(tx.timestamp) * 1000).toLocaleString()}
									{:else}
										{tx.hash.slice(0, 12)}...
									{/if}
								</p>
							</div>
							<p class="shrink-0 font-mono text-sm tabular-nums {tx.direction === 'in' ? 'text-green-500' : ''}">
								{tx.direction === 'in' ? '+' : '-'}{tx.amount} XRP
							</p>
						</button>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>
</div>