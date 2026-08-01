<script lang="ts">
	import { moneroWallet } from '$lib/states/monero-wallet.svelte.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import { Textarea } from '$lib/components/ui/textarea/index.js'
	import { Input } from '$lib/components/ui/input/index.js'
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from '$lib/components/ui/card/index.js'
	import Loader from '$lib/components/loader.svelte'
	import { navigate } from 'sv-router/generated'

	const w = moneroWallet

	let moneroWalletName = $state('')
	let moneroMnemonic = $state('')
	let moneroRestoreHeight = $state<number | undefined>(undefined)

	let initStarted = false

	$effect(() => {
		if (w.walletOpen && w.walletName) {
			navigate('/monero/wallet/:name', {
				params: { name: w.walletName },
			})
		}
	})

	$effect(() => {
		if (!initStarted) {
			initStarted = true
			w.init().then(async () => {
				if (w.accountType === 'monero') return
				await w.login()
			})
		}
	})

	$effect(() => {
		if (w.running && !w.walletOpen && w.wallets.length > 0 && !w.loading) {
			w.autoUnlock(w.wallets[0])
		}
	})
</script>

<div class="mx-auto max-w-lg">
	<div class="flex flex-col gap-4">
		{#if !w.ready}
			<p class="text-center text-muted-foreground text-sm mt-8">
				Loading...
			</p>
		{:else if !w.accountType}
			<p class="text-center text-muted-foreground text-sm mt-8">
				<a href="/" class="underline">Go to welcome page</a>
				to get started
			</p>
		{:else if w.accountType === 'monero'}
			{#if w.downloading}
				<Card>
					<CardContent>
						<p class="text-muted-foreground text-xs">
							Downloading Monero binary (70MB)...
						</p>
					</CardContent>
				</Card>
			{:else if !w.installed}
				<Card>
					<CardHeader>
						<CardTitle>Monero Setup</CardTitle>
						<CardDescription>
							Download monero-wallet-rpc to get started
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button onclick={() => w.download()}>
							Download (~70MB)
						</Button>
					</CardContent>
				</Card>
			{:else if !w.running}
				<Card>
					<CardHeader>
						<CardTitle>Monero Wallet</CardTitle>
						<CardDescription>
							Start the wallet RPC server to connect to the Monero
							network
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button onclick={() => w.start()} disabled={w.loading}>
							{#if w.loading}
								<Loader />
							{/if}
							Start
						</Button>
					</CardContent>
				</Card>
			{:else if !w.walletOpen}
				{#if w.wallets.length > 0}
					<Card>
						<CardContent class="flex items-center justify-center py-8">
							<Loader />
							<span class="ml-2 text-sm text-muted-foreground">
								Opening wallet...
							</span>
						</CardContent>
					</Card>
				{:else}
					<Card>
						<CardHeader>
							<CardTitle>Monero Wallet</CardTitle>
							<CardDescription>
								Create a new wallet or restore from seed
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div class="flex flex-col gap-3">
								<p class="text-xs text-muted-foreground">
									Create a new wallet:
								</p>
								<Input
									placeholder="Wallet name"
									bind:value={moneroWalletName} />
								<Button
									onclick={() =>
										w.createWallet(
											moneroWalletName,
											crypto.randomUUID(),
											true,
										)}
									disabled={w.loading || !moneroWalletName}>
									Create Wallet
								</Button>
								<hr class="border-muted" />
								<p class="text-xs text-muted-foreground">
									Restore from seed
								</p>
								<Textarea
									placeholder="Enter your Monero seed phrase (16 or 25 words)"
									bind:value={moneroMnemonic} />
								<Input
									type="number"
									placeholder="Restore height (optional)"
									bind:value={moneroRestoreHeight} />
								<Button
									onclick={() =>
										w.restoreWallet(
											moneroWalletName,
											crypto.randomUUID(),
											moneroMnemonic,
											moneroRestoreHeight,
											true,
										)}
									disabled={w.loading ||
										!moneroWalletName ||
										!moneroMnemonic.trim()}>
									Restore Wallet
								</Button>
							</div>
						</CardContent>
					</Card>
				{/if}
			{/if}
		{/if}
	</div>
</div>