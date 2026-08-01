<script lang="ts">
	import { xrpWallet } from '$lib/states/xrp-wallet.svelte.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import { Input } from '$lib/components/ui/input/index.js'
	import { Textarea } from '$lib/components/ui/textarea/index.js'
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

	const w = xrpWallet

	let inputWalletName = $state('')
	let inputSeed = $state('')
	let inputPassword = $state('')
	let inputUnlockPassword = $state('')
	let newSeed = $state<string | null>(null)

	let initStarted = false

	$effect(() => {
		if (!initStarted) {
			initStarted = true
			w.init().then(async () => {
				if (w.accountType === 'xrp') return
				await w.login()
			})
		}
	})

	$effect(() => {
		if (w.accountType === 'xrp' && w.currentWalletId && w.seed && !newSeed) {
			navigate('/xrp/wallet/:id', {
				params: { id: w.currentWalletId },
			})
		}
	})

	const handleCreate = async () => {
		const seed = await w.createWallet(
			inputWalletName,
			inputPassword || undefined,
		)
		newSeed = seed ?? null
	}

	const handleImport = async () => {
		await w.importWallet(
			inputWalletName,
			inputSeed.trim(),
			inputPassword || undefined,
		)
	}
</script>

<div class="mx-auto max-w-xl">
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
		{:else}
			{#if newSeed}
				<Card>
					<CardHeader>
						<CardTitle>Wallet Created</CardTitle>
						<CardDescription>
							Save this seed phrase — it is the only way to recover
							your wallet
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div class="rounded-md border border-destructive/50 bg-destructive/5 p-3 mb-3">
							<p class="text-xs text-destructive font-medium mb-2">
								Never share your seed. Anyone with it can access your
								funds.
							</p>
							<p class="font-mono text-xs break-all">{newSeed}</p>
						</div>
						<p class="text-xs text-muted-foreground mb-3">
							Your XRP address becomes active after it receives at
							least 10 XRP (the base reserve).
						</p>
						<Button
							class="w-full"
							onclick={() => {
								newSeed = null
								inputWalletName = ''
								inputPassword = ''
							}}>
							I saved my seed
						</Button>
					</CardContent>
				</Card>
			{:else if w.wallets.length === 0}
				<Card>
					<CardHeader>
						<CardTitle>Create / Import Wallet</CardTitle>
						<CardDescription>
							Generate a new XRP wallet or import an existing seed
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div class="flex flex-col gap-3">
							<Input
								placeholder="Wallet name (e.g. Main, Savings)"
								bind:value={inputWalletName} />
							<Button
								onclick={handleCreate}
								disabled={w.loading || !inputWalletName.trim()}>
								{w.loading ? 'Creating...' : 'Generate New Wallet'}
							</Button>
							<hr class="border-muted" />
							<p class="text-xs text-muted-foreground">
								Or import an existing wallet:
							</p>
							<Textarea
								placeholder="XRP seed (s...) or 12/24-word phrase"
								bind:value={inputSeed} />
							<Input
								type="password"
								placeholder="Set a password (optional)"
								bind:value={inputPassword} />
							<Button
								variant="outline"
								onclick={handleImport}
								disabled={w.loading ||
									!inputSeed.trim() ||
									!inputWalletName.trim()}>
								{w.loading ? 'Importing...' : 'Import Wallet'}
							</Button>
						</div>
						{#if w.error}
							<p class="mt-3 text-xs text-red-500">{w.error}</p>
						{/if}
					</CardContent>
				</Card>
			{:else if w.isLocked}
				<Card>
					<CardHeader>
						<CardTitle>
							{w.currentWallet?.name ?? 'Wallet'} Locked
						</CardTitle>
						<CardDescription>
							Unlock to access your wallet
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div class="flex flex-col gap-3">
							{#if w.biometricAvailable}
								<Button
									onclick={() => w.unlockWithBiometrics()}
									disabled={w.loading}>
									<Fingerprint size={16} />
									{w.loading ? 'Unlocking...' : 'Unlock with Touch ID'}
								</Button>
							{/if}
							{#if w.currentPasswordHash}
								<div class="flex gap-2 items-end">
									<Input
										type="password"
										placeholder="Enter password"
										bind:value={inputUnlockPassword} />
									<Button
										onclick={async () => {
											const ok = await w.unlockWithPassword(
												inputUnlockPassword,
											)
											if (!ok) w.error = 'Wrong password'
											inputUnlockPassword = ''
										}}
										disabled={w.loading || !inputUnlockPassword}
										size="sm">
										{#if w.loading}
											<Loader />
										{:else}
											Unlock
										{/if}
									</Button>
								</div>
							{/if}
						</div>
						{#if w.error}
							<p class="mt-3 text-xs text-red-500">{w.error}</p>
						{/if}
					</CardContent>
				</Card>
			{/if}
		{/if}
	</div>
</div>
