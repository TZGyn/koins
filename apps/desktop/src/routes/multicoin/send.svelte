<script lang="ts">
	import { evmWallet as wallet } from '$lib/states/evm-wallet.svelte.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import { Input } from '$lib/components/ui/input/index.js'
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
	} from '$lib/components/ui/select/index.js'
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription,
	} from '$lib/components/ui/card/index.js'
	import { navigate } from 'sv-router/generated'

	const w = wallet

	type TokenOption = {
		symbol: string
		balance: string
		contractAddress: string
		decimals: number
		logo?: string
	}

	const tokens = $derived<TokenOption[]>([
		{
			symbol: w.symbol,
			balance: w.balance,
			contractAddress: '',
			decimals: 18,
		},
		...w.tokenBalances.map((t) => ({
			symbol: t.symbol,
			balance: t.balance,
			contractAddress: t.contractAddress,
			decimals: t.decimals,
			logo: t.logo,
		})),
	])

	let selectedSymbol = $state(w.symbol)
	let recipient = $state('')
	let amount = $state('')
	let sending = $state(false)
	let sentResult = $state<{ txHash: string } | null>(null)
	let sendError = $state('')

	const selectedToken = $derived(
		tokens.find((t) => t.symbol === selectedSymbol) ?? tokens[0],
	)

	const exceedsBalance = $derived(
		amount !== '' &&
			selectedToken.balance !== '0' &&
			parseFloat(amount) > parseFloat(selectedToken.balance),
	)

	const canSend = $derived(
		recipient.length === 42 &&
			recipient.startsWith('0x') &&
			amount !== '' &&
			parseFloat(amount) > 0 &&
			!exceedsBalance &&
			!sending,
	)

	const handleSend = async () => {
		sending = true
		sendError = ''
		sentResult = null
		try {
			const txHash = await w.send(
				recipient,
				amount,
				selectedToken.contractAddress || undefined,
				selectedToken.decimals,
			)
			sentResult = { txHash }
			recipient = ''
			amount = ''
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
		onclick={() => navigate(w.network === 'eth' ? '/multicoin' : `/multicoin/${w.network}`)}
		class="mb-4">
		&larr; Back
	</Button>

	<Card>
		<CardHeader>
			<CardTitle>Send</CardTitle>
			<CardDescription>
				Balance: {selectedToken.balance} {selectedToken.symbol}
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
					<label class="text-xs font-medium">Asset</label>
					<Select type="single" bind:value={selectedSymbol}>
						<SelectTrigger>
							{selectedToken.symbol}
						</SelectTrigger>
						<SelectContent>
							{#each tokens as t}
								<SelectItem value={t.symbol}>
									{t.symbol} ({t.balance})
								</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				</div>

				<div class="space-y-1.5">
					<label class="text-xs font-medium">Recipient Address</label>
					<Input
						placeholder="0x..."
						bind:value={recipient} />
				</div>

				<div class="space-y-1.5">
					<label class="text-xs font-medium">Amount ({selectedToken.symbol})</label>
					<Input
						type="number"
						step="0.000000000000000001"
						min="0"
						placeholder="0.0"
						bind:value={amount} />
					{#if exceedsBalance}
						<p class="text-xs text-red-500">
							Amount exceeds balance
						</p>
					{/if}
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
						<a
							href="{w.explorerUrl}{sentResult.txHash}"
							target="_blank"
							rel="noopener noreferrer"
							class="underline hover:text-green-500">
							{sentResult.txHash}
						</a>
					</p>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
