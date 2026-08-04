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
	import { arc } from 'd3-shape'
	import { tweened } from 'svelte/motion'
	import { cubicOut } from 'svelte/easing'

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

	const xrpShare = $derived(portfolioUsd > 0 ? xrpTotalUsd / portfolioUsd : 0)
	const xmrShare = $derived(
		portfolioUsd > 0 ? xmrTotalUsd / portfolioUsd : 0,
	)

	const tweenedUsd = tweened(0, { duration: 600, easing: cubicOut })
	const tweenedXrpShare = tweened(0, { duration: 600, easing: cubicOut })

	$effect(() => {
		tweenedUsd.set(portfolioUsd)
		tweenedXrpShare.set(xrpShare)
	})

	const donut = $derived.by(() => {
		if (portfolioUsd <= 0) return { xrp: '', xmr: '' }
		const a = arc<{ startAngle: number; endAngle: number }>()
			.innerRadius(62)
			.outerRadius(80)
			.padAngle(0.02)
		const start = -Math.PI / 2
		const endXrp = start + $tweenedXrpShare * 2 * Math.PI
		return {
			xrp: a({ startAngle: start, endAngle: endXrp }) ?? '',
			xmr: a({ startAngle: endXrp, endAngle: start + 2 * Math.PI }) ?? '',
		}
	})

	const hasXrp = $derived(xrpWallet.wallets.length > 0)
	const hasXmr = $derived(moneroWallet.wallets.length > 0)
	const noWallets = $derived(!hasXrp && !hasXmr)

	const moneroDot = $derived(
		!moneroWallet.running
			? 'bg-muted'
			: !moneroWallet.connected
				? 'bg-red-500'
				: moneroWallet.syncing || moneroWallet.height < moneroWallet.daemonHeight
					? 'bg-yellow-500 animate-pulse'
					: 'bg-emerald-500',
	)

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

	const fmtPct = (v: number) => `${Math.round(v * 100)}%`

	onMount(() => {
		frontendLog('dashboard mounted')
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

			<Card>
				<CardHeader class="pb-2">
					<CardTitle class="text-base">Portfolio Allocation</CardTitle>
					<CardDescription class="text-xs">
						Share of your balance by asset
					</CardDescription>
				</CardHeader>
				<CardContent class="flex flex-col items-center gap-5 py-6">
					<div class="relative">
						<svg viewBox="-100 -100 200 200" class="size-48">
							<path d={donut.xrp} fill="#0EA5E9" />
							<path d={donut.xmr} fill="#F97316" />
						</svg>
						<div
							class="absolute inset-0 flex flex-col items-center justify-center">
							<p
								class="text-lg font-semibold tabular-nums">$
								{fmtUsd($tweenedUsd)}
							</p>
							<p class="text-xs text-muted-foreground">
								Portfolio
							</p>
						</div>
					</div>
					<div class="flex gap-5 text-xs">
						<span class="flex items-center gap-1.5">
							<span class="size-2.5 rounded-full bg-sky-500"></span>
							XRP · {fmtPct($tweenedXrpShare)}
						</span>
						<span class="flex items-center gap-1.5">
							<span class="size-2.5 rounded-full bg-orange-500"></span>
							XMR · {fmtPct(1 - $tweenedXrpShare)}
						</span>
					</div>
				</CardContent>
			</Card>

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
						<CardDescription class="text-xs">XRP Ledger</CardDescription>
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
						<CardDescription class="flex items-center gap-1.5 text-xs">
							<span class="size-2 shrink-0 rounded-full {moneroDot}"></span>
							{#if !moneroWallet.running}
								Server offline
							{:else if !moneroWallet.connected}
								Connecting to daemon…
							{:else}
								{fmtBal(moneroWallet.height, 0)} / {fmtBal(moneroWallet.daemonHeight, 0)}
							{/if}
						</CardDescription>
					</CardHeader>
					<CardContent class="flex flex-1 flex-col justify-center">
						{#if moneroWallet.walletOpen}
							<p class="font-mono text-xl tabular-nums">{fmtBal(xmrBalance, 4)}</p>
							{#if !moneroWallet.syncing && moneroWallet.price}
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