<script lang="ts">
	import {
		moneroWallet,
		atomicToXmr,
	} from '$lib/states/monero-wallet.svelte.js'
	import { electrobun } from '$lib/electrobun.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import { Input } from '$lib/components/ui/input/index.js'
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
	} from '$lib/components/ui/select/index.js'
	import * as Dialog from '$lib/components/ui/dialog/index.js'
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
	} from '$lib/components/ui/card/index.js'
	import ArrowDown from '@lucide/svelte/icons/arrow-down'
	import ArrowUp from '@lucide/svelte/icons/arrow-up'
	import Send from '@lucide/svelte/icons/send'
	import QrCodeIcon from '@lucide/svelte/icons/qr-code'
	import Plus from '@lucide/svelte/icons/plus'
	import Users from '@lucide/svelte/icons/users'
	import Tags from '@lucide/svelte/icons/tags'
	import Loader from '$lib/components/loader.svelte'
	import QrCode from '$lib/components/qr.svelte'
	import { navigate, route } from 'sv-router/generated'
	import { CopyButton } from '$lib/components/ui/copy-button'
	import { onMount } from 'svelte'
	import { LineChart } from 'layerchart'
	import { scaleUtc } from 'd3-scale'
	import { curveLinear } from 'd3-shape'
	import * as Chart from '$lib/components/ui/chart/index.js'

	const w = moneroWallet

	const chunkAddress = (addr: string) => {
		const start = addr.slice(0, 6)
		const mid = addr.slice(6, 12)
		const end = addr.slice(-6)
		return { start, mid, end }
	}

	let qrDialogOpen = $state(false)
	let subQrDialogOpen = $state<string | null>(null)
	let moneroMnemonic = $state('')
	let feeEstimate = $state<{
		fee: string
		fees: string[]
		estimatedFee: string
	} | null>(null)
	let moneroPrice = $state<{ usd: string } | null>(null)
	let selectedRange = $state<'1D' | '1W' | '1M' | '1Y' | 'ALL'>('ALL')

	const rangeCutoff = $derived(
		selectedRange === 'ALL'
			? 0
			: Date.now() -
					(
						{
							'1D': 86400000,
							'1W': 604800000,
							'1M': 2592000000,
							'1Y': 31536000000,
						} as const
					)[selectedRange],
	)

	const balanceHistory = $derived.by(() => {
		const sorted = [...w.txs].reverse()
		if (sorted.length === 0) return []
		const points: { date: Date; balance: number }[] = []
		let cum = 0n
		for (const tx of sorted) {
			const amt = BigInt(tx.amount)
			if (tx.direction === 'in') cum += amt
			else cum -= amt
			points.push({
				date: new Date(Number(tx.timestamp) * 1000),
				balance: parseFloat(atomicToXmr(cum.toString())),
			})
		}
		points.push({
			date: new Date(),
			balance: parseFloat(atomicToXmr(cum.toString())),
		})
		return points
	})

	const chartData = $derived(
		selectedRange === 'ALL'
			? balanceHistory
			: balanceHistory.filter((p) => p.date.getTime() >= rangeCutoff),
	)

	let accountDialogOpen = $state(false)
	let accountLabel = $state('')
	let accountBusy = $state(false)
	let accountError = $state('')
	let subaddressDialogOpen = $state(false)
	let subaddressAccountIndex = $state('')
	let subaddressLabel = $state('')
	let subaddressBusy = $state(false)
	let subaddressError = $state('')

	$effect(() => {
		if (!subaddressAccountIndex && w.accounts.length > 0) {
			subaddressAccountIndex = String(w.accounts[0].index)
		}
	})

	async function handleCreateAccount() {
		if (accountBusy) return
		accountBusy = true
		accountError = ''
		try {
			await w.createAccount(accountLabel || undefined)
			accountDialogOpen = false
			accountLabel = ''
		} catch (e) {
			accountError = e instanceof Error ? e.message : 'Failed to create account'
		} finally {
			accountBusy = false
		}
	}

	async function handleCreateSubaddress() {
		if (subaddressBusy || !subaddressAccountIndex) return
		subaddressBusy = true
		subaddressError = ''
		try {
			await w.createSubaddress(
				parseInt(subaddressAccountIndex),
				subaddressLabel || undefined,
			)
			subaddressDialogOpen = false
			subaddressAccountIndex = ''
			subaddressLabel = ''
		} catch (e) {
			subaddressError = e instanceof Error ? e.message : 'Failed to create subaddress'
		} finally {
			subaddressBusy = false
		}
	}

	const walletName = $derived(route.params.name)

	let autoRefreshTimer: ReturnType<typeof setInterval> | undefined = $state()

	$effect(() => {
		if (w.walletOpen && !autoRefreshTimer) {
			autoRefreshTimer = setInterval(() => {
				electrobun.rpc?.request
					.fetchMoneroPrice({})
					.then((p) => (moneroPrice = p))
			}, 30000)
		} else if (!w.walletOpen && autoRefreshTimer) {
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

	$effect(() => {
		if (w.walletOpen) {
			electrobun.rpc?.request
				.moneroGetFeeEstimate({})
				.then((fee) => (feeEstimate = fee))
		}
	})

	onMount(() => {
		if (w.walletOpen && w.walletName === walletName) {
			w.refresh()
			electrobun.rpc?.request
				.fetchMoneroPrice({})
				.then((p) => (moneroPrice = p))
		}
	})

	$effect(() => {
		if (!w.opening && (!w.walletOpen || w.walletName !== walletName)) {
			navigate('/monero')
		}
	})
</script>

{#if !w.walletOpen || w.walletName !== walletName}
	<div class="flex flex-col items-center justify-center gap-3 py-24">
		<Loader />
		<p class="text-sm text-muted-foreground">Opening wallet...</p>
	</div>
{:else}
<div class="space-y-6">
	<div class="flex flex-col items-center py-2">
		{#if w.loading && !w.syncing}
			<div class="h-12 w-40 rounded-lg bg-muted animate-pulse"></div>
		{:else}
			<p class="text-sm text-muted-foreground">Balance</p>
			<p class="mt-1 font-mono text-4xl font-semibold tabular-nums tracking-tight">
				{w.balance} <span class="text-muted-foreground text-2xl">XMR</span>
			</p>
			{#if moneroPrice}
				<p class="mt-1 text-sm text-muted-foreground tabular-nums">
					≈ ${(parseFloat(w.balance) * parseFloat(moneroPrice.usd)).toLocaleString(undefined, {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					})}
				</p>
			{/if}
			{#if w.unlockedAtomic !== w.balAtomic}
				<p class="mt-1 text-xs text-muted-foreground">
					Unlocked: {w.unlocked} XMR
				</p>
			{/if}
			{#if w.syncing}
				<div class="mt-2 flex items-center gap-2">
					<Loader />
					<p class="text-xs text-muted-foreground">
						Syncing wallet — balance updates when the scan completes
					</p>
				</div>
			{/if}
			<div class="mt-2 flex items-center gap-1.5">
				<div class="size-2 rounded-full {w.connected ? 'bg-green-500' : 'bg-red-500'}"></div>
				<span class="text-xs text-muted-foreground">
					{w.connected ? 'Connected' : 'Disconnected'}
					{#if w.height < w.daemonHeight}
						· Scanning {w.height.toLocaleString()} / {w.daemonHeight.toLocaleString()}
					{/if}
				</span>
			</div>
		{/if}
	</div>

	<div class="flex items-center justify-center">
		<Button onclick={() => navigate('/monero/send')} class="gap-2">
			<Send size={16} />
			Send
		</Button>
	</div>

	<div class="mx-auto max-w-md">
		<div class="flex items-center justify-between rounded-lg border border-border px-4 py-3">
			<div class="min-w-0 flex-1">
				<p class="text-xs text-muted-foreground mb-0.5">Address</p>
				<p class="font-mono text-xs break-all">
					<span>{chunkAddress(w.address).start}</span>
					<span class="text-muted-foreground">{chunkAddress(w.address).mid}</span>
					<span class="text-muted-foreground/40">...</span>
					<span>{chunkAddress(w.address).end}</span>
				</p>
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
			</div>
		</div>
		{#if feeEstimate}
			<p class="mt-2 text-center text-xs text-muted-foreground">
				Fee: ~{atomicToXmr(((BigInt(feeEstimate.fees[2]) * 2500n) / 1000n).toString())} XMR (Normal)
			</p>
		{/if}
	</div>

	{#if balanceHistory.length > 1}
		<Card>
			<CardHeader>
				<div class="flex items-center justify-between">
					<CardTitle class="text-sm">Balance History</CardTitle>
					<div class="inline-flex rounded-lg bg-muted p-0.5">
						{#each ['1D', '1W', '1M', '1Y', 'ALL'] as const as range}
							<button
								onclick={() => (selectedRange = range)}
								class="rounded-md px-2.5 py-1 text-xs font-medium transition-all {selectedRange === range ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}">
								{range}
							</button>
						{/each}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{#if chartData.length > 1}
					<Chart.Container config={{ balance: { label: 'XMR', color: 'var(--chart-1)' } }}>
						<LineChart
							data={chartData}
							x="date"
							xScale={scaleUtc()}
							axis="x"
							points
							series={[{ key: 'balance', label: 'XMR', color: 'var(--chart-1)' }]}
							yDomain={[
								chartData.reduce((a, b) => (a.balance < b.balance ? a : b)).balance,
								chartData.reduce((a, b) => (a.balance > b.balance ? a : b)).balance,
							]}
							props={{
								spline: { curve: curveLinear, motion: 'tween', strokeWidth: 2 },
								yAxis: {},
								xAxis: { format: (v: Date) => v.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
								highlight: { points: { r: 4 } },
							}}>
							{#snippet tooltip()}
								<Chart.Tooltip
									labelFormatter={(value: Date) => value.toLocaleDateString()}
									valueFormatter={(value: Number) => value.toString().slice(0, 8)} />
							{/snippet}
						</LineChart>
					</Chart.Container>
				{:else}
					<p class="text-center text-sm text-muted-foreground py-4">No data in this range</p>
				{/if}
			</CardContent>
		</Card>
	{/if}

	<Card>
		<CardHeader>
			<div class="flex items-center justify-between">
				<CardTitle class="text-sm">Transactions</CardTitle>
				{#if w.accounts.length > 0}
					<div class="inline-flex rounded-lg bg-muted p-0.5">
						{#each w.accounts as acct}
							<button
								onclick={() => { w.selectedAccountIndex = acct.index; w.refresh() }}
								class="rounded-md px-2.5 py-1 text-xs font-medium transition-all {w.selectedAccountIndex === acct.index ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}">
								{acct.index}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</CardHeader>
		<CardContent>
			{#if w.loading}
				<div class="flex justify-center py-8"><Loader /></div>
			{:else if w.txs.length === 0}
				<p class="text-center text-sm text-muted-foreground py-8">No transactions yet</p>
			{:else}
				<div class="space-y-1">
					{#each w.txs as tx}
						<button
							onclick={() => navigate(`/monero/tx/:hash`, { params: { hash: tx.hash } })}
							class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted transition-colors">
							<div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
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
								</p>
								<p class="text-xs text-muted-foreground">
									{#if tx.timestamp && tx.timestamp !== '0'}
										{new Date(Number(tx.timestamp) * 1000).toLocaleString()}
									{/if}
								</p>
							</div>
							<p class="shrink-0 font-mono text-sm tabular-nums {tx.direction === 'in' ? 'text-green-500' : ''}">
								{tx.direction === 'in' ? '+' : '-'}{atomicToXmr(tx.amount)} XMR
							</p>
						</button>
					{/each}
				</div>
			{/if}
		</CardContent>
	</Card>

	<Card>
		<CardHeader>
			<div class="flex items-center justify-between">
				<CardTitle class="text-sm">Accounts & Addresses</CardTitle>
				<div class="flex gap-1.5">
					<Dialog.Root bind:open={accountDialogOpen}>
						<Dialog.Trigger>
							<Button size="sm" variant="ghost" class="gap-1 text-xs">
								<Plus size={12} /> Account
							</Button>
						</Dialog.Trigger>
						<Dialog.Content>
							<Dialog.Header>
								<div class="flex items-center gap-3">
									<div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
										<Users size={16} class="text-muted-foreground" />
									</div>
									<div class="space-y-0.5">
										<Dialog.Title>Create Account</Dialog.Title>
										<Dialog.Description>
											New account with its own balance and addresses
										</Dialog.Description>
									</div>
								</div>
							</Dialog.Header>
							<div class="px-6 pb-4 space-y-3">
								<div class="space-y-1.5">
									<label class="text-xs font-medium" for="account-label">Label</label>
									<Input id="account-label" placeholder="Savings" bind:value={accountLabel} />
									<p class="text-xs text-muted-foreground">
										Optional — shown next to the account in your wallet
									</p>
								</div>
								{#if accountError}
									<p class="text-xs text-destructive">{accountError}</p>
								{/if}
								<div class="flex justify-end gap-2">
									<Button
										variant="outline"
										size="sm"
										disabled={accountBusy}
										onclick={() => {
											accountDialogOpen = false
											accountLabel = ''
											accountError = ''
										}}>
										Cancel
									</Button>
									<Button size="sm" disabled={accountBusy} onclick={handleCreateAccount}>
										{accountBusy ? 'Creating...' : 'Create'}
									</Button>
								</div>
							</div>
						</Dialog.Content>
					</Dialog.Root>
					<Dialog.Root bind:open={subaddressDialogOpen}>
						<Dialog.Trigger>
							<Button size="sm" variant="ghost" class="gap-1 text-xs">
								<Plus size={12} /> Subaddress
							</Button>
						</Dialog.Trigger>
						<Dialog.Content>
							<Dialog.Header>
								<div class="flex items-center gap-3">
									<div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
										<Tags size={16} class="text-muted-foreground" />
									</div>
									<div class="space-y-0.5">
										<Dialog.Title>Create Subaddress</Dialog.Title>
										<Dialog.Description>
											Receiving address tied to an account
										</Dialog.Description>
									</div>
								</div>
							</Dialog.Header>
							<div class="px-6 pb-4 space-y-3">
								<div class="space-y-1.5">
									<label class="text-xs font-medium" for="subaddress-account">Account</label>
									<Select type="single" bind:value={subaddressAccountIndex}>
										<SelectTrigger>
											Account {subaddressAccountIndex}
										</SelectTrigger>
										<SelectContent>
											{#each w.accounts as acct}
												<SelectItem value={String(acct.index)}>
													Account {acct.index}{acct.label ? ` - ${acct.label}` : ''} ({atomicToXmr(acct.unlockedBalance)} XMR)
												</SelectItem>
											{/each}
										</SelectContent>
									</Select>
									<p class="text-xs text-muted-foreground">
										Where the subaddress belongs
									</p>
								</div>
								<div class="space-y-1.5">
									<label class="text-xs font-medium" for="subaddress-label">Label</label>
									<Input id="subaddress-label" placeholder="Donations" bind:value={subaddressLabel} />
									<p class="text-xs text-muted-foreground">
										Optional — helps you track who sent you funds
									</p>
								</div>
								{#if subaddressError}
									<p class="text-xs text-destructive">{subaddressError}</p>
								{/if}
								<div class="flex justify-end gap-2">
									<Button
										variant="outline"
										size="sm"
										disabled={subaddressBusy}
										onclick={() => {
											subaddressDialogOpen = false
											subaddressAccountIndex = ''
											subaddressLabel = ''
											subaddressError = ''
										}}>
										Cancel
									</Button>
									<Button
										size="sm"
										disabled={subaddressBusy || !subaddressAccountIndex}
										onclick={handleCreateSubaddress}>
										{subaddressBusy ? 'Creating...' : 'Create'}
									</Button>
								</div>
							</div>
						</Dialog.Content>
					</Dialog.Root>
				</div>
			</div>
		</CardHeader>
		<CardContent>
			<div class="space-y-2">
				{#each w.accounts as account}
					{@const a = chunkAddress(account.primaryAddress)}
					<div class="rounded-lg border border-border p-3">
						<div class="mb-1 flex items-center justify-between">
							<p class="text-xs font-medium">Account {account.index}{account.label ? ` — ${account.label}` : ''}</p>
							<p class="text-xs text-muted-foreground tabular-nums">{atomicToXmr(account.balance)} XMR</p>
						</div>
						<div class="flex items-center gap-2">
							<p class="min-w-0 flex-1 font-mono text-xs text-muted-foreground break-all">
								<span>{a.start}</span><span>{a.mid}</span><span class="text-muted-foreground/40">...</span><span>{a.end}</span>
							</p>
							<div class="flex shrink-0 gap-1">
								<Dialog.Root open={subQrDialogOpen === account.primaryAddress} onopenchange={(v) => { subQrDialogOpen = v ? account.primaryAddress : null }}>
									<Dialog.Trigger>
										<Button variant="ghost" size="icon-xs" class="text-muted-foreground" aria-label="QR"><QrCodeIcon size={12} /></Button>
									</Dialog.Trigger>
									<Dialog.Content>
										<div class="flex flex-col items-center gap-3 py-4">
											<QrCode text={account.primaryAddress} size={256} />
											<p class="font-mono text-xs break-all text-center max-w-64">{account.primaryAddress}</p>
										</div>
									</Dialog.Content>
								</Dialog.Root>
								<CopyButton text={account.primaryAddress} variant="ghost" size="icon-xs" class="text-muted-foreground" />
							</div>
						</div>
						{#if account.subaddresses.length > 1}
							<div class="mt-2 space-y-1 border-t border-border pt-2">
								{#each account.subaddresses as sub}
									{@const sa = chunkAddress(sub.address)}
									<div class="rounded-md px-2 py-1.5 text-xs">
										<div class="flex items-center justify-between">
											<p class="font-medium">#{sub.index}{sub.label ? ` - ${sub.label}` : ''}</p>
											<p class="text-muted-foreground tabular-nums">{atomicToXmr(sub.balance)} XMR</p>
										</div>
										<div class="flex items-center gap-2 mt-0.5">
											<p class="min-w-0 flex-1 font-mono text-muted-foreground truncate">
												<span>{sa.start}</span><span>{sa.mid}</span><span class="text-muted-foreground/40">...</span><span>{sa.end}</span>
											</p>
											<div class="flex shrink-0 gap-1">
												<Dialog.Root open={subQrDialogOpen === sub.address} onopenchange={(v) => { subQrDialogOpen = v ? sub.address : null }}>
													<Dialog.Trigger>
														<Button variant="ghost" size="icon-xs" class="text-muted-foreground" aria-label="QR"><QrCodeIcon size={12} /></Button>
													</Dialog.Trigger>
													<Dialog.Content>
														<div class="flex flex-col items-center gap-3 py-4">
															<QrCode text={sub.address} size={256} />
															<p class="font-mono text-xs break-all text-center max-w-64">{sub.address}</p>
														</div>
													</Dialog.Content>
												</Dialog.Root>
												<CopyButton text={sub.address} variant="ghost" size="icon-xs" class="text-muted-foreground" />
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</CardContent>
	</Card>
</div>
{/if}