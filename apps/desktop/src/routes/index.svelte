<script lang="ts">
	import { moneroWallet } from '$lib/states/monero-wallet.svelte.js'
	import { xrpWallet } from '$lib/states/xrp-wallet.svelte.js'
	import { electrobun } from '$lib/electrobun.js'
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

	let xrpPrice = $state<string | null>(null)
	let xmrPrice = $state<string | null>(null)
	let xrpBalances = $state<Record<string, { balance: number; funded: boolean }>>({})
	let loadingXrp = $state(true)
	let loadingXmr = $state(true)

	let feError = $state<string | null>(null)

	const usd = (amount: string, price: string | null) =>
		price ? parseFloat(amount) * parseFloat(price) : 0

	const xrpTotalUsd = $derived.by(() => {
		const price = xrpPrice
		return xrpWallet.wallets.reduce((sum, w) => {
			const b = xrpBalances[w.address]?.balance ?? 0
			return sum + (price ? b * parseFloat(price) : 0)
		}, 0)
	})

	const xrpTotalBalance = $derived.by(() =>
		xrpWallet.wallets.reduce((sum, w) => {
			return sum + (xrpBalances[w.address]?.balance ?? 0)
		}, 0),
	)

	const xmrBalance = $derived(
		moneroWallet.walletOpen ? parseFloat(moneroWallet.balance || '0') : 0,
	)
	const xmrTotalUsd = $derived(
		moneroWallet.walletOpen && xmrPrice
			? xmrBalance * parseFloat(xmrPrice)
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

	async function fetchXrp() {
		loadingXrp = true
		const rpc = electrobun.rpc
		if (!rpc) {
			loadingXrp = false
			return
		}
		try {
			const p = await rpc.request.fetchXrpPrice({})
			if (p) xrpPrice = p.usd
		} catch { /* ignore */ }
		await Promise.allSettled(
			xrpWallet.wallets.map(async (w) => {
				const res = await rpc.request.xrpGetBalance({
					address: w.address,
				})
				xrpBalances[w.address] = {
					balance: parseFloat(res.balance),
					funded: res.funded,
				}
			}),
		)
		loadingXrp = false
	}

	async function fetchXmr() {
		loadingXmr = true
		const rpc = electrobun.rpc
		if (!rpc) {
			loadingXmr = false
			return
		}
		try {
			const p = await rpc.request.fetchMoneroPrice({})
			xmrPrice = p?.usd ?? null
		} catch { /* ignore */ }
		loadingXmr = false
	}

	onMount(() => {
		frontendLog('dashboard mounted')
		moneroWallet.init().catch((e) => frontendLogError('moneroWallet.init() failed', e))
		xrpWallet.init().then(async () => {
			await fetchXrp()
		})
		fetchXmr()
	})

	$effect(() => {
		if (moneroWallet.walletOpen) {
			fetchXmr()
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
			{#if loadingXrp || loadingXmr}
				<div class="mt-2 h-9 w-44 rounded-md bg-muted animate-pulse"></div>
			{:else}
				<p class="mt-1 text-3xl font-semibold tabular-nums">
					${fmtUsd(portfolioUsd)}
				</p>
			{/if}
		</div>

		<div class="grid grid-cols-2 gap-4">
			<button
				onclick={() => navigate('/xrp')}
				class="text-left transition-transform active:scale-[0.98]">
				<Card class="hover:border-foreground/20 transition-colors">
					<CardHeader class="pb-3">
						<div class="flex items-center gap-2">
							<img src="/icons/xrp.png" alt="" class="size-5 rounded-full" />
							<CardTitle class="text-base">XRP</CardTitle>
						</div>
						<CardDescription class="text-xs">
							{xrpWallet.wallets.length} wallet{xrpWallet.wallets.length !== 1 ? 's' : ''}
						</CardDescription>
					</CardHeader>
					<CardContent>
						{#if loadingXrp}
							<div class="h-14 flex items-center"><Loader /></div>
						{:else}
							<p class="font-mono text-xl tabular-nums">{fmtBal(xrpTotalBalance)}</p>
							{#if xrpPrice}
								<p class="mt-0.5 text-sm text-muted-foreground tabular-nums">
									${fmtUsd(xrpTotalUsd)}
								</p>
								<p class="mt-2 text-xs text-muted-foreground">
									${fmtUsd(parseFloat(xrpPrice) )} / XRP
								</p>
							{/if}
						{/if}
					</CardContent>
				</Card>
			</button>

			<button
				onclick={() => navigate('/monero')}
				class="text-left transition-transform active:scale-[0.98]">
				<Card class="hover:border-foreground/20 transition-colors">
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
					<CardContent>
						{#if loadingXmr && !moneroWallet.walletOpen}
							<div class="h-14 flex items-center"><Loader /></div>
						{:else if moneroWallet.walletOpen}
							<p class="font-mono text-xl tabular-nums">{fmtBal(xmrBalance, 4)}</p>
							{#if xmrPrice}
								<p class="mt-0.5 text-sm text-muted-foreground tabular-nums">
									${fmtUsd(xmrTotalUsd)}
								</p>
								<p class="mt-2 text-xs text-muted-foreground">
									${fmtUsd(parseFloat(xmrPrice) )} / XMR
								</p>
							{/if}
						{:else if moneroWallet.wallets.length > 0}
							<p class="text-sm text-muted-foreground py-3">Open wallet to view balance</p>
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

		{#if xrpWallet.wallets.length > 1}
			<Card>
				<CardHeader class="pb-3">
					<CardTitle class="text-sm">XRP Wallets</CardTitle>
				</CardHeader>
				<CardContent>
					<div class="space-y-1">
						{#each xrpWallet.wallets as wal}
							<button
								onclick={() => {
									xrpWallet.selectAndUnlockWallet(wal.id)
									navigate('/xrp')
								}}
								class="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-muted transition-colors">
								<WalletIcon size={16} class="shrink-0 text-muted-foreground" />
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium">{wal.name}</p>
									<p class="text-xs text-muted-foreground truncate font-mono">{wal.address}</p>
								</div>
								{#if xrpBalances[wal.address]?.funded === false}
									<span class="text-xs text-muted-foreground">unfunded</span>
								{:else if xrpBalances[wal.address]}
									<span class="font-mono text-sm tabular-nums">
										{fmtBal(xrpBalances[wal.address].balance)}
									</span>
								{/if}
							</button>
						{/each}
					</div>
				</CardContent>
			</Card>
		{/if}

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