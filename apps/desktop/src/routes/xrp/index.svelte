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
	import LockKeyhole from '@lucide/svelte/icons/lock-keyhole'
	import Plus from '@lucide/svelte/icons/plus'
	import WalletIcon from '@lucide/svelte/icons/wallet'
	import Loader from '$lib/components/loader.svelte'
	import { navigate } from 'sv-router/generated'

	const w = xrpWallet

	let inputWalletName = $state('')
	let inputSeed = $state('')
	let inputPassword = $state('')
	let inputUnlockPassword = $state('')
	let showCreateForm = $state(false)
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
		{:else}
			<a
				href="/"
				class="text-xs text-muted-foreground underline mb-1 inline-block">
				← Back to home
			</a>
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
			{:else if w.wallets.length === 0 || showCreateForm}
				<Card>
					<CardHeader>
						<CardTitle>
							{showCreateForm ? 'Add Another Wallet' : 'Create / Import Wallet'}
						</CardTitle>
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
							<div class="flex gap-2">
								<Button
									variant="outline"
									onclick={handleImport}
									disabled={w.loading ||
										!inputSeed.trim() ||
										!inputWalletName.trim()}>
									{w.loading ? 'Importing...' : 'Import Wallet'}
								</Button>
								{#if showCreateForm}
									<Button
										variant="outline"
										onclick={() => (showCreateForm = false)}>
										Cancel
									</Button>
								{/if}
							</div>
						</div>
						{#if w.error}
							<p class="mt-3 text-xs text-red-500">{w.error}</p>
						{/if}
					</CardContent>
				</Card>
			{:else if !w.currentWalletId}
				<Card>
					<CardHeader>
						<CardTitle>Wallets</CardTitle>
						<CardDescription>Select a wallet to use</CardDescription>
					</CardHeader>
					<CardContent>
						<div class="flex flex-col gap-2">
							{#each w.wallets as wal}
								<button
									onclick={async () => {
										if (wal.hasPassword) {
											await w.selectWallet(wal.id)
										} else {
											await w.selectAndUnlockWallet(wal.id)
										}
									}}
									class="flex w-full cursor-pointer items-center gap-3 rounded-md border border-input p-3 text-left hover:bg-muted transition-colors">
									<WalletIcon
										size={20}
										class="shrink-0 text-muted-foreground" />
									<div class="flex-1 min-w-0">
										<p class="font-medium text-sm">{wal.name}</p>
										<p class="text-xs text-muted-foreground truncate font-mono">
											{wal.address}
										</p>
									</div>
									<div class="flex items-center gap-1">
										{#if wal.hasPassword}
											<LockKeyhole
												size={14}
												class="text-muted-foreground" />
										{/if}
									</div>
								</button>
							{/each}
							<Button
								variant="outline"
								onclick={() => (showCreateForm = true)}
								class="mt-2">
								<Plus size={16} />
								Add Wallet
							</Button>
						</div>
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
							<Button
								variant="outline"
								onclick={() => w.clearSelection()}>
								Pick another wallet
							</Button>
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
