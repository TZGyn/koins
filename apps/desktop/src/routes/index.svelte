<script lang="ts">
	import { moneroWallet } from '$lib/states/monero-wallet.svelte.js'
	import { xrpWallet } from '$lib/states/xrp-wallet.svelte.js'
	import { navigate } from 'sv-router/generated'
	import { onMount } from 'svelte'
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription,
	} from '$lib/components/ui/card/index.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import Plus from '@lucide/svelte/icons/plus'
	import WalletIcon from '@lucide/svelte/icons/wallet'
	import Loader from '$lib/components/loader.svelte'
	import { frontendLog, frontendLogError } from '$lib/electrobun.js'

	let feError = $state<string | null>(null)

	const xrpTotalUsd = $derived.by(() => {
		const p = xrpWallet.price
		return xrpWallet.wallets.reduce((sum, w) => {
			const b = xrpWallet.balances[w.address]?.balance ?? 0
			return sum + (p ? b * parseFloat(p) : 0)
		}, 0)
	})

	const xrpTotalBalance = $derived.by(() =>
		xrpWallet.wallets.reduce((sum, w) => {
			return sum + (xrpWallet.balances[w.address]?.balance ?? 0)
		}, 0),
	)

	const xmrBalance = $derived(
		moneroWallet.walletOpen ? parseFloat(moneroWallet.balance || '0') : 0,
	)
	const xmrTotalUsd = $derived(
		moneroWallet.walletOpen && moneroWallet.price
			? xmrBalance * parseFloat(moneroWallet.price)
			: 0,
	)

	const portfolioUsd = $derived(xrpTotalUsd + xmrTotalUsd)

	const hasXrp = $derived(xrpWallet.wallets.length > 0)
	const hasXmr = $derived(moneroWallet.wallets.length > 0)
	const noWallets = $derived(!hasXrp && !hasXmr)

	const fmtUsd = (v: number) =>
		v.toLocaleString(undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		})

	const fmtBal = (v: number, dp = 2) =>
		v.toLocaleString(undefined, {
			minimumFractionDigits: 0,
			maximumFractionDigits: dp,
		})

	onMount(() => {
		frontendLog('dashboard mounted')
		moneroWallet.init().catch((e) => frontendLogError('moneroWallet.init() failed', e))
		xrpWallet.init().catch((e) => frontendLogError('xrpWallet.init() failed', e))
	})

	// Balances live in the stores so they survive navigation; the effects
	// only trigger background refetches.
	$effect(() => {
		if (xrpWallet.ready && xrpWallet.wallets.length > 0) {
			xrpWallet.fetchBalances()
		}
	})

	$effect(() => {
		if (moneroWallet.walletOpen) {
			moneroWallet.fetchPrice()
		}
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

<div class="space-y-6">
	{#if noWallets}
		<div class="flex flex-col items-center justify-center py-16">
			<WalletIcon size={48} class="text-muted-foreground/50" />
			<p class="mt-4 text-lg font-medium">Welcome to Koins</p>
			<p class="mb-6 text-sm text-muted-foreground">Choose an asset to get started</p>
			<div class="flex gap-3">
				<Button
					onclick={() => navigate('/xrp')}
					variant="outline"
					class="gap-2">
					<img src="/icons/xrp.png" alt="" class="size-4 rounded-full" />
					Set up XRP
				</Button>
				<Button
					onclick={() => navigate('/monero')}
					variant="outline"
					class="gap-2">
					<img src="/icons/monero.png" alt="" class="size-4 rounded-full" />
					Set up Monero
				</Button>
			</div>
		</div>
	{:else}
		<div class="flex flex-col items-center pt-4 pb-2">
			<p class="text-xs text-muted-foreground">Total Portfolio Value</p>
			{#if moneroWallet.opening || (moneroWallet.wallets.length > 0 && !moneroWallet.walletOpen) || (xrpWallet.wallets.length > 0 && !xrpWallet.price) || (moneroWallet.walletOpen && !moneroWallet.price)}
				<div class="mt-2 h-9 w-44 rounded-md bg-muted animate-pulse"></div>
			{:else}
				<p class="mt-1 text-3xl font-semibold tabular-nums">
					${fmtUsd(portfolioUsd)}
				</p>
			{/if}
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<button
				onclick={() => navigate('/xrp')}
				class="text-left transition-transform active:scale-[0.98]">
				<Card class="h-44 hover:border-foreground/20 transition-colors">
					<CardHeader class="pb-3">
						<div class="flex items-center gap-2">
							<img src="/icons/xrp.png" alt="" class="size-5 rounded-full" />
							<CardTitle class="text-base">XRP</CardTitle>
						</div>
						<CardDescription class="text-xs">
							{xrpWallet.wallets.length} wallet{xrpWallet.wallets.length !== 1 ? 's' : ''}
						</CardDescription>
					</CardHeader>
					<CardContent class="flex flex-1 flex-col justify-center">
						{#if !xrpWallet.ready || (xrpWallet.wallets.length > 0 && Object.keys(xrpWallet.balances).length === 0)}
							<div class="h-14 flex items-center"><Loader /></div>
						{:else}
							<p class="font-mono text-xl tabular-nums">{fmtBal(xrpTotalBalance)}</p>
							{#if xrpWallet.price}
								<p class="mt-0.5 text-sm text-muted-foreground tabular-nums">
									${fmtUsd(xrpTotalUsd)}
								</p>
								<p class="mt-2 text-xs text-muted-foreground">
									${fmtUsd(parseFloat(xrpWallet.price) )} / XRP
								</p>
							{/if}
						{/if}
					</CardContent>
				</Card>
			</button>

			<button
				onclick={() => navigate('/monero')}
				class="text-left transition-transform active:scale-[0.98]">
				<Card class="h-44 hover:border-foreground/20 transition-colors">
					<CardHeader class="pb-3">
						<div class="flex items-center gap-2">
							<img src="/icons/monero.png" alt="" class="size-5 rounded-full" />
							<CardTitle class="text-base">Monero</CardTitle>
						</div>
						<CardDescription class="text-xs">
							{moneroWallet.walletOpen
								? moneroWallet.walletName || 'Wallet open'
								: moneroWallet.wallets.length > 0
									? `${moneroWallet.wallets.length} wallet${moneroWallet.wallets.length !== 1 ? 's' : ''}`
									: 'Not set up'}
						</CardDescription>
					</CardHeader>
					<CardContent class="flex flex-1 flex-col justify-center">
						{#if moneroWallet.walletOpen}
							<p class="font-mono text-xl tabular-nums">{fmtBal(xmrBalance, 4)}</p>
							{#if moneroWallet.syncing}
								<p class="mt-0.5 text-xs text-muted-foreground">Syncing…</p>
							{:else if moneroWallet.price}
								<p class="mt-0.5 text-sm text-muted-foreground tabular-nums">
									${fmtUsd(xmrTotalUsd)}
								</p>
							{/if}
							{#if moneroWallet.price}
								<p class="mt-2 text-xs text-muted-foreground">
									${fmtUsd(parseFloat(moneroWallet.price) )} / XMR
								</p>
							{/if}
						{:else if moneroWallet.passwordRequired && moneroWallet.wallets.length > 0}
							<p class="text-sm text-muted-foreground py-3">Wallet locked — unlock to view balance</p>
						{:else if moneroWallet.opening}
							<div class="h-14 flex items-center gap-2">
								<Loader />
								<p class="text-sm text-muted-foreground">
									{moneroWallet.wallets.length > 0 ? 'Opening wallet...' : 'Starting wallet server...'}
								</p>
							</div>
						{:else if moneroWallet.error}
							<div class="py-3">
								<p class="text-xs text-destructive break-words">{moneroWallet.error}</p>
								<Button
									variant="outline"
									size="sm"
									class="mt-2 gap-1.5"
									onclick={() => moneroWallet.login()}>
									Retry
								</Button>
							</div>
						{:else if moneroWallet.wallets.length > 0}
							<div class="h-14 flex items-center gap-2">
								<Loader />
								<p class="text-sm text-muted-foreground">Opening wallet...</p>
							</div>
						{:else}
							<Button
								onclick={() => navigate('/monero')}
								variant="outline"
								size="sm"
								class="gap-1.5">
								<Plus size={14} />
								Set up
							</Button>
						{/if}
					</CardContent>
				</Card>
			</button>
		</div>

	<div class="flex gap-3">
			<Button
				onclick={() => navigate('/xrp')}
				variant="outline"
				class="flex-1 gap-2">
				<img src="/icons/xrp.png" alt="" class="size-4 rounded-full" />
				XRP Wallet
			</Button>
			<Button
				onclick={() => navigate('/monero')}
				variant="outline"
				class="flex-1 gap-2">
				<img src="/icons/monero.png" alt="" class="size-4 rounded-full" />
				Monero Wallet
			</Button>
		</div>
	{/if}
</div>