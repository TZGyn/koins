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
	import Fingerprint from '@lucide/svelte/icons/fingerprint'
	import Loader from '$lib/components/loader.svelte'
	import { navigate } from 'sv-router/generated'

	const w = moneroWallet

	let moneroWalletName = $state('')
	let moneroWalletPass = $state('')
	let moneroMnemonic = $state('')
	let moneroRestoreHeight = $state<number | undefined>(undefined)
	let moneroSelectedWallet = $state('')
	let moneroSelectedWalletPass = $state('')
	let moneroUseBiometric = $state(false)

	let initStarted = false

	$effect(() => {
		if (w.walletOpen && w.walletName) {
			navigate('/monero/wallet/:name', {
				params: {
					name: w.walletName,
				},
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
</script>

<div class="mx-auto mt-16 max-w-md">
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
			<a href="/" class="text-xs text-muted-foreground underline mb-1 inline-block">
				← Back to home
			</a>
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
				<Card>
					<CardHeader>
						<CardTitle>Monero Wallet</CardTitle>
						<CardDescription>
							{w.wallets.length > 0
								? `${w.wallets.length} wallet${w.wallets.length > 1 ? 's' : ''} found on disk`
								: 'No existing wallets found'}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div class="flex flex-col gap-3">
							{#if w.wallets.length > 0}
								<p class="text-xs font-medium">
									Select a wallet to open:
								</p>
								<div class="flex flex-wrap gap-2">
									{#each w.wallets as name}
										<Button
											variant={moneroSelectedWallet === name
												? 'default'
												: 'outline'}
											onclick={() => {
												moneroSelectedWallet = name
												moneroSelectedWalletPass = ''
											}}>
											{name}
										</Button>
									{/each}
								</div>
								{#if moneroSelectedWallet}
									<div class="flex flex-col gap-2">
										{#if w.biometricAvailable}
											<Button
												onclick={async () => {
													const ok = await w.biometricAuth()
													if (ok) {
														await w.openExistingWallet(
															moneroSelectedWallet,
														)
													}
												}}
												disabled={w.loading}>
												<Fingerprint size={14} />
												Open with Touch ID
											</Button>
										{/if}
										<div class="flex gap-2 items-end">
											<Input
												type="password"
												placeholder="Enter password"
												bind:value={moneroSelectedWalletPass} />
											<Button
												onclick={() =>
													w.openExistingWallet(
														moneroSelectedWallet,
														moneroSelectedWalletPass,
													)}
												disabled={w.loading ||
													!moneroSelectedWalletPass}>
												Open
											</Button>
										</div>
									</div>
								{/if}
								<hr class="border-muted" />
							{/if}
							<p class="text-xs text-muted-foreground">
								Or create a new wallet:
							</p>
							<Input
								placeholder="Wallet name"
								bind:value={moneroWalletName} />
							{#if w.biometricAvailable}
								<label
									class="flex items-center gap-2 text-xs cursor-pointer">
									<input
										type="checkbox"
										bind:checked={moneroUseBiometric} />
									Save password with Touch ID
								</label>
							{/if}
							{#if !moneroUseBiometric}
								<Input
									type="password"
									placeholder="Password"
									bind:value={moneroWalletPass} />
							{/if}
							<div class="flex gap-2">
								<Button
									onclick={async () => {
										const pw = moneroUseBiometric
											? crypto.randomUUID()
											: moneroWalletPass
										await w.createWallet(
											moneroWalletName,
											pw,
											moneroUseBiometric,
										)
									}}
									disabled={w.loading ||
										!moneroWalletName ||
										(!moneroUseBiometric && !moneroWalletPass)}>
									Create Wallet
								</Button>
							</div>
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
							{#if !moneroUseBiometric}
								<Input
									type="password"
									placeholder="Password"
									bind:value={moneroWalletPass} />
							{/if}
							<Button
								onclick={async () => {
									await w.restoreWallet(
										moneroWalletName,
										moneroUseBiometric
											? crypto.randomUUID()
											: moneroWalletPass,
										moneroMnemonic,
										moneroRestoreHeight,
										moneroUseBiometric,
									)
								}}
								disabled={w.loading ||
									!moneroWalletName ||
									(!moneroUseBiometric && !moneroWalletPass) ||
									!moneroMnemonic.trim()}>
								Restore Wallet
							</Button>
						</div>
					</CardContent>
				</Card>
			{/if}
		{/if}
	</div>
</div>
