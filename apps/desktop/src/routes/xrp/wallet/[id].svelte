<script lang="ts">
	import { xrpWallet, xrpNetwork } from '$lib/states/xrp-wallet.svelte.js'
	import { electrobun } from '$lib/electrobun.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from '$lib/components/ui/card/index.js'
	import ArrowDown from '@lucide/svelte/icons/arrow-down'
	import ArrowUp from '@lucide/svelte/icons/arrow-up'
	import SettingsIcon from '@lucide/svelte/icons/settings'
	import QrCodeIcon from '@lucide/svelte/icons/qr-code'
	import ExternalLink from '@lucide/svelte/icons/external-link'
	import Loader from '$lib/components/loader.svelte'
	import QrCode from '$lib/components/qr.svelte'
	import * as Dialog from '$lib/components/ui/dialog/index.js'
	import { CopyButton } from '$lib/components/ui/copy-button'
	import { navigate, route } from 'sv-router/generated'
	import { onMount } from 'svelte'

	const w = xrpWallet

	const walletId = $derived(route.params.id)

	let qrDialogOpen = $state(false)
	let autoRefreshTimer: ReturnType<typeof setInterval> | undefined =
		$state()

	$effect(() => {
		if (w.seed && !autoRefreshTimer) {
			autoRefreshTimer = setInterval(() => {
				w.refresh()
			}, 30000)
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

<div class="mx-auto max-w-xl">
	<div class="flex flex-col gap-4">
		<Card>
			<CardHeader>
				<div class="flex items-center justify-between">
					<CardTitle>
						{w.currentWallet?.name ?? 'XRP Wallet'}
					</CardTitle>
					<img src="/icons/xrp.png" alt="" class="size-6 rounded-full" />
				</div>
				<CardDescription>XRP Ledger</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="mb-4 space-y-1">
					<div class="flex items-start gap-3">
						<div class="min-w-0 flex-1 space-y-1">
							<p class="font-medium text-xs">Address</p>
							<p class="font-mono text-xs break-all">{w.address}</p>
							<div class="flex gap-1.5 mt-1">
								<Dialog.Root bind:open={qrDialogOpen}>
									<Dialog.Trigger>
										<Button
											variant="outline"
											size="icon-sm"
											class="text-muted-foreground"
											aria-label="Show QR code">
											<QrCodeIcon size={16} />
										</Button>
									</Dialog.Trigger>
									<Dialog.Content>
										<div
											class="flex flex-col items-center gap-3 py-4">
											<QrCode text={w.address} size={256} />
											<p
												class="font-mono text-xs break-all text-center max-w-64">
												{w.address}
											</p>
										</div>
									</Dialog.Content>
								</Dialog.Root>
								<CopyButton
									text={w.address}
									variant="outline"
									size="icon-sm"
									class="text-muted-foreground">
								</CopyButton>
								<Button
									variant="outline"
									size="icon-sm"
									class="text-muted-foreground"
									aria-label="View on explorer"
									onclick={() =>
										electrobun.rpc?.request.openExternal({
											url: w.explorerAddressUrl,
										})}>
									<ExternalLink size={16} />
								</Button>
							</div>
						</div>
					</div>
					<p class="mt-2 font-medium text-xs">Balance</p>
					{#if w.loadingBalance}
						<div class="py-1"><Loader /></div>
					{:else}
						<div class="flex items-baseline gap-2">
							<p class="font-mono text-lg">{w.balance} XRP</p>
							{#if w.price}
								<p class="font-mono text-sm text-muted-foreground">
									≈ ${(
										parseFloat(w.balance) * parseFloat(w.price)
									).toLocaleString(undefined, {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2,
									})}
								</p>
							{/if}
						</div>
						{#if !w.funded}
							<p class="text-xs text-muted-foreground">
								Account not activated — it needs at least 10 XRP to
								meet the base reserve.
							</p>
						{/if}
						{#if w.fee}
							<p class="text-xs text-muted-foreground mt-1">
								Network fee: ~{w.fee} XRP
							</p>
						{/if}
					{/if}
				</div>

				<div class="flex gap-2">
					<Button
						variant="outline"
						onclick={() => navigate('/xrp/send')}>
						Send
					</Button>
					<Button
						variant="outline"
						onclick={() => navigate('/settings')}>
						<SettingsIcon size={16} />
					</Button>
					<Button
						variant="outline"
						onclick={async () => {
							await w.logout()
							navigate('/')
						}}>
						Logout
					</Button>
				</div>
			</CardContent>
		</Card>

		<Card>
			<CardHeader>
				<CardTitle>Transactions</CardTitle>
			</CardHeader>
			<CardContent>
				{#if w.loadingTransactions}
					<div class="flex justify-center py-4">
						<Loader />
					</div>
				{:else if w.transactions.length === 0}
					<p class="text-muted-foreground text-xs">
						No transactions found
					</p>
				{:else}
					<div class="max-h-96 space-y-1 overflow-y-auto">
						{#each w.transactions as tx}
							<button
								onclick={() =>
									navigate('/xrp/tx/:hash', {
										params: { hash: tx.hash },
									})}
								class="flex w-full items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-left cursor-pointer hover:bg-muted/80 transition-colors">
								<div
									class="shrink-0 mt-0.5 {tx.direction === 'in'
										? 'text-green-500'
										: 'text-muted-foreground'}">
									{#if tx.direction === 'in'}
										<ArrowDown size={16} />
									{:else}
										<ArrowUp size={16} />
									{/if}
								</div>
								<div class="min-w-0 flex-1 space-y-0.5">
									<p class="font-medium">
										{tx.direction === 'in' ? 'Received' : 'Sent'}
										{#if !tx.confirmed}
											<span class="text-muted-foreground">
												(unconfirmed)
											</span>
										{/if}
									</p>
									<p class="font-mono text-muted-foreground">
										{tx.amount} XRP
									</p>
									{#if tx.timestamp && tx.timestamp !== '0'}
										<p class="text-muted-foreground">
											{new Date(
												Number(tx.timestamp) * 1000,
											).toLocaleString()}
										</p>
									{/if}
									<p
										class="text-muted-foreground/50 truncate font-mono">
										{tx.hash.slice(0, 12)}...
									</p>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</CardContent>
		</Card>
	</div>
</div>
