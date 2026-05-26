<script lang="ts">
	import {
		moneroWallet,
		atomicToXmr,
	} from '$lib/states/monero-wallet.svelte.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import { Input } from '$lib/components/ui/input/index.js'
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription,
	} from '$lib/components/ui/card/index.js'
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
	} from '$lib/components/ui/select/index.js'
	import { navigate } from 'sv-router/generated'

	const w = moneroWallet

	let recipient = $state('')
	let amountXmr = $state('')
	let sendAll = $state(false)
	let priority = $state('0')
	let accountIndex = $state(
		w.accounts.length > 0 ? String(w.accounts[0].index) : '0',
	)
	let sending = $state(false)
	let sentResult = $state<{ txHash: string; fee: string } | null>(
		null,
	)
	let sendError = $state('')

	const selectedAccount = $derived(
		w.accounts.find((a) => String(a.index) === accountIndex),
	)

	const unlockedAtomic = $derived(
		selectedAccount?.unlockedBalance ?? w.unlockedAtomic,
	)
	const balanceAtomic = $derived(
		selectedAccount?.balance ?? w.balAtomic,
	)

	const amountAtomic = $derived.by(() => {
		if (!amountXmr) return 0n
		const num = parseFloat(amountXmr)
		if (isNaN(num) || num <= 0) return 0n
		return BigInt(Math.round(num * 1e12))
	})
	const exceedsBalance = $derived(
		amountAtomic > BigInt(unlockedAtomic),
	)
	const canSend = $derived(
		recipient.startsWith('4') &&
			recipient.length >= 95 &&
			(sendAll || amountAtomic > 0n) &&
			(sendAll || !exceedsBalance) &&
			!sending,
	)

	const handleSend = async () => {
		sending = true
		sendError = ''
		sentResult = null
		try {
			const result = sendAll
				? await w.sendAll(
						recipient,
						parseInt(priority),
						parseInt(accountIndex),
					)
				: await w.send(
						recipient,
						amountAtomic.toString(),
						parseInt(priority),
						parseInt(accountIndex),
					)
			sentResult = { txHash: result.txHash, fee: result.fee }
			recipient = ''
			amountXmr = ''
			sendAll = false
		} catch (e) {
			sendError = e instanceof Error ? e.message : 'Send failed'
		} finally {
			sending = false
		}
	}
</script>

<div class="mx-auto mt-16 max-w-md">
	<Button
		variant="outline"
		size="sm"
		onclick={() => navigate('/monero')}
		class="mb-4">
		&larr; Back
	</Button>

	<Card>
		<CardHeader>
			<CardTitle>Send XMR</CardTitle>
			<CardDescription>
				Balance: {atomicToXmr(unlockedAtomic)} XMR
				{#if unlockedAtomic !== balanceAtomic}
					(locked: {atomicToXmr(
						(
							BigInt(balanceAtomic) - BigInt(unlockedAtomic)
						).toString(),
					)} XMR)
				{/if}
			</CardDescription>
		</CardHeader>
		<CardContent>
			<form
				onsubmit={(e) => {
					e.preventDefault()
					handleSend()
				}}
				class="space-y-4">
				<div class="space-y-1.5">
					<label class="text-xs font-medium">From Account</label>
					<Select type="single" bind:value={accountIndex}>
						<SelectTrigger>
							{accountIndex}
						</SelectTrigger>
						<SelectContent>
							{#each w.accounts as acct}
								<SelectItem value={String(acct.index)}>
									Account {acct.index}{acct.label
										? ` - ${acct.label}`
										: ''}
									({atomicToXmr(acct.unlockedBalance)} XMR)
								</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>

				<div class="space-y-1.5">
					<label class="text-xs font-medium">Recipient Address</label>
					<Input
						placeholder="Monero address starting with 4..."
						bind:value={recipient} />
				</div>

				<div class="space-y-1.5">
					<label class="text-xs font-medium">Amount (XMR)</label>
					<div class="relative">
						<Input
							type="number"
							step="0.000000000001"
							min="0"
							placeholder="0.0"
							bind:value={amountXmr}
							disabled={sendAll} />
						<span
							class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
							XMR
						</span>
					</div>
					<label class="flex items-center gap-2 text-xs">
						<input
							type="checkbox"
							bind:checked={sendAll}
							class="h-3.5 w-3.5" />
						Send all unlocked XMR (fee deducted automatically)
					</label>
					{#if exceedsBalance && !sendAll}
						<p class="text-xs text-red-500">
							Amount exceeds unlocked balance
						</p>
					{/if}
					<p class="text-xs text-muted-foreground">
						{new Intl.NumberFormat().format(Number(amountAtomic))} atomic
						units
					</p>
				</div>

				<div class="space-y-1.5">
					<label class="text-xs font-medium">Priority</label>
					<Select type="single" bind:value={priority}>
						<SelectTrigger>
							{priority}
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="0">Default</SelectItem>
							<SelectItem value="1">Unimportant</SelectItem>
							<SelectItem value="2">Normal</SelectItem>
							<SelectItem value="3">Elevated</SelectItem>
							<SelectItem value="4">Priority</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<Button type="submit" disabled={!canSend} class="w-full">
					{sending ? 'Sending...' : 'Send'}
				</Button>
			</form>

			{#if sendError}
				<p class="mt-3 text-xs text-red-500">{sendError}</p>
			{/if}

			{#if sentResult}
				<div
					class="mt-4 space-y-2 rounded-md border border-green-500/30 bg-green-500/5 p-3">
					<p class="text-xs font-medium text-green-600">
						Transaction Sent
					</p>
					<p class="font-mono text-xs break-all">
						Hash: {sentResult.txHash}
					</p>
					<p class="font-mono text-xs">
						Fee: {atomicToXmr(sentResult.fee)} XMR
					</p>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
