<script lang="ts">
	import { xrpWallet } from '$lib/states/xrp-wallet.svelte.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import { Input } from '$lib/components/ui/input/index.js'
	import {
		Card,
		CardContent,
		CardHeader,
		CardTitle,
		CardDescription,
	} from '$lib/components/ui/card/index.js'
	import { navigate } from 'sv-router/generated'
	import QrUpload from '$lib/components/qr-upload.svelte'
	import { parseQrPayload } from '$lib/qr.js'

	const w = xrpWallet

	let recipient = $state('')
	let destinationTag = $state('')
	let amountXrp = $state('')
	let sending = $state(false)
	let sentResult = $state<{ hash: string; fee: string } | null>(null)
	let sendError = $state('')

	const isValidAddress = $derived(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(recipient))

	const amount = $derived(parseFloat(amountXrp))
	const amountValid = $derived(!isNaN(amount) && amount > 0)
	const exceedsBalance = $derived(amountValid && amount > parseFloat(w.balance))
	const tagValid = $derived(
		destinationTag === '' ||
			(/^\d+$/.test(destinationTag) && Number(destinationTag) <= 4294967295),
	)
	const canSend = $derived(
		isValidAddress &&
			amountValid &&
			!exceedsBalance &&
			tagValid &&
			!sending,
	)

	const handleSend = async () => {
		sending = true
		sendError = ''
		sentResult = null
		try {
			const result = await w.send(
				recipient,
				amount.toString(),
				destinationTag === '' ? undefined : Number(destinationTag),
			)
			sentResult = result
			recipient = ''
			destinationTag = ''
			amountXrp = ''
		} catch (e) {
			sendError = e instanceof Error ? e.message : 'Send failed'
		} finally {
			sending = false
		}
	}
</script>

<div class="mx-auto max-w-lg">
	<Card>
		<CardHeader>
			<CardTitle>Send XRP</CardTitle>
			<CardDescription>
				Balance: {w.balance} XRP
				{#if w.fee}
					(fee: ~{w.fee} XRP)
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
					<div class="flex items-center justify-between">
						<label class="text-xs font-medium">Recipient Address</label>
						<QrUpload
							onDecode={(text) => {
								const parsed = parseQrPayload(text, 'xrp')
								recipient = parsed.address
								if (parsed.destinationTag) destinationTag = parsed.destinationTag
								if (parsed.amount) amountXrp = parsed.amount
							}} />
					</div>
					<Input
						placeholder="XRP address starting with r..."
						bind:value={recipient} />
					{#if recipient && !isValidAddress}
						<p class="text-xs text-red-500">Invalid XRP address</p>
					{/if}
				</div>

				<div class="space-y-1.5">
					<label class="text-xs font-medium">
						Destination Tag (optional)
					</label>
					<Input
						type="number"
						min="0"
						step="1"
						placeholder="Required by some exchanges"
						bind:value={destinationTag} />
					{#if !tagValid}
						<p class="text-xs text-red-500">
							Destination tag must be a number between 0 and
							4294967295
						</p>
					{/if}
				</div>

				<div class="space-y-1.5">
					<label class="text-xs font-medium">Amount (XRP)</label>
					<div class="relative">
						<Input
							type="number"
							step="0.000001"
							min="0"
							placeholder="0.0"
							bind:value={amountXrp} />
						<span
							class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
							XRP
						</span>
					</div>
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
						Hash: {sentResult.hash}
					</p>
					<p class="font-mono text-xs">
						Fee: {sentResult.fee} XRP
					</p>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
