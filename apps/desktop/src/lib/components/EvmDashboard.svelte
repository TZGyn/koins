<script lang="ts">
	import { electrobun, type TxEntry } from '$lib/electrobun.js'
	import { wallet, type NetworkId } from '$lib/states/wallet.svelte.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import { Textarea } from '$lib/components/ui/textarea/index.js'
	import { navigate } from 'sv-router/generated'
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from '$lib/components/ui/card/index.js'
	import ArrowDown from '@lucide/svelte/icons/arrow-down'
	import ArrowUp from '@lucide/svelte/icons/arrow-up'
	import QrCodeIcon from '@lucide/svelte/icons/qr-code'
	import SettingsIcon from '@lucide/svelte/icons/settings'
	import Fingerprint from '@lucide/svelte/icons/fingerprint'
	import * as Dialog from '$lib/components/ui/dialog/index.js'
	import QRCode from 'qrcode'

	let { networkId }: { networkId: NetworkId } = $props()

	const CDN =
		'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains'

	const chainDir: Record<string, string> = {
		eth: 'ethereum',
		bsc: 'smartchain',
		polygon: 'polygon',
	}

	function nativeIcon(id: string) {
		return `${CDN}/${chainDir[id]}/info/logo.png`
	}

	function tokenIcon(id: string, address?: string) {
		if (!address) return ''
		return `${CDN}/${chainDir[id]}/assets/${address}/logo.png`
	}

	function txAction(tx: TxEntry, address: string): string {
		if (tx.pairedValue) return 'Swap'
		const dir =
			tx.from.toLowerCase() === address.toLowerCase()
				? 'Sent'
				: 'Received'
		if (tx.tokenSymbol) return `${dir} ${tx.tokenSymbol}`
		return dir
	}

	const w = wallet
	let inputSeed = $state('')
	let inputPassword = $state('')
	let inputUnlockPassword = $state('')
	let apiKeyInput = $state('')
	let qrDataUrl = $state('')
	let qrDialogOpen = $state(false)
	$effect(() => {
		if (w.address) {
			QRCode.toDataURL(w.address, { width: 256, margin: 1 }).then(
				(url) => (qrDataUrl = url),
			)
		}
	})

	function navTarget(id: NetworkId): string {
		if (id === 'eth') return '/multicoin'
		return `/multicoin/${id}`
	}

	let initStarted = false
	$effect(() => {
		if (!initStarted) {
			initStarted = true
			w.init().then(async () => {
				if (w.accountType === 'multi') {
					await w.switchNetwork(networkId)
				}
			})
		}
	})
</script>

{#if !w.ready}
	<div class="mx-auto mt-16 max-w-md text-center text-muted-foreground text-sm">Loading...</div>
{:else if !w.vaultExists}
		<Card>
			<CardHeader>
				<CardTitle>Import Wallet</CardTitle>
				<CardDescription>
					Enter your seed phrase to save it securely in your system keychain
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="flex flex-col gap-3">
					<Textarea
						placeholder="Enter your 12 or 24 word seed phrase"
						bind:value={inputSeed} />
					<input
						type="password"
						placeholder="Set a password (optional, used when Touch ID is unavailable)"
						class="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 font-mono text-xs"
						bind:value={inputPassword} />
					<Button
						onclick={() => w.saveVault(inputSeed, inputPassword || undefined)}
						disabled={w.loading || !inputSeed.trim()}>
						{w.loading ? 'Saving...' : 'Save to Keychain'}
					</Button>
				</div>
				{#if w.error}
					<p class="mt-3 text-red-500">{w.error}</p>
				{/if}
			</CardContent>
		</Card>
	{:else if w.isLocked}
		<Card>
			<CardHeader>
				<CardTitle>Wallet Locked</CardTitle>
				<CardDescription>Your seed is stored in the system keychain</CardDescription>
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
					{#if w.passwordSet}
						<div class="flex gap-2 items-end">
							<input
								type="password"
								placeholder="Enter password"
								class="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 font-mono text-xs"
								bind:value={inputUnlockPassword} />
							<Button
								onclick={async () => {
									const ok = await w.unlockWithPassword(inputUnlockPassword)
									if (!ok) w.error = 'Wrong password'
									inputUnlockPassword = ''
								}}
								disabled={w.loading || !inputUnlockPassword}
								size="sm">
								{w.loading ? '...' : 'Unlock'}
							</Button>
						</div>
					{/if}
				</div>
				{#if w.error}
					<p class="mt-3 text-red-500">{w.error}</p>
				{/if}
			</CardContent>
		</Card>
	{:else}
		<div class="flex flex-col gap-4">
			<div class="flex gap-1 justify-center" role="group">
				{#each w.evmNetworks as net}
					<button
						class="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors {w.network ===
						net.id
							? 'bg-primary text-primary-foreground'
							: 'bg-muted text-muted-foreground hover:bg-muted/80'}"
						onclick={() => navigate(navTarget(net.id))}>
						{net.name}
					</button>
				{/each}
			</div>

			<Card>
				<CardHeader>
					<div class="flex items-center justify-between">
						<div>
							<CardTitle>Wallet</CardTitle>
							<CardDescription>
								Your wallet is unlocked
							</CardDescription>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{#if w.address}
						<div class="mb-4 space-y-1">
							<p class="font-medium text-xs">Address</p>
							<div class="flex items-start gap-2">
								<p class="font-mono text-xs break-all flex-1">{w.address}</p>
								{#if qrDataUrl}
									<Dialog.Root bind:open={qrDialogOpen}>
										<Dialog.Trigger>
											<button
												class="shrink-0 cursor-pointer rounded-md border p-1.5 text-muted-foreground hover:bg-muted transition-colors">
												<QrCodeIcon size={16} />
											</button>
										</Dialog.Trigger>
										<Dialog.Content>
											<div class="flex flex-col items-center gap-3 py-4">
												<div class="relative">
													<img
														src={qrDataUrl}
														alt="QR code"
														class="size-52 rounded-md" />
													<img
														src={nativeIcon(w.network)}
														alt=""
														class="absolute left-1/2 top-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white p-0.5" />
												</div>
												<p class="font-mono text-xs break-all text-center max-w-64">
													{w.address}
												</p>
											</div>
										</Dialog.Content>
									</Dialog.Root>
								{/if}
							</div>
							<p class="mt-2 font-medium text-xs">
								{w.symbol} Balance
							</p>
							<p class="flex items-center gap-1.5 font-mono text-lg">
								<img
									src={nativeIcon(w.network)}
									alt=""
									class="size-4 rounded-full"
									onerror={(e) =>
										((e.target as HTMLElement).style.display =
											'none')} />
								{w.balance}
								{w.symbol}
							</p>
						</div>
						<div class="mb-4 space-y-1">
							<p class="font-medium text-xs">Tokens</p>
							{#each w.tokenBalances as t}
								<p
									class="flex items-center gap-1.5 font-mono text-sm">
									<img
										src={t.logo}
										alt=""
										class="size-4 rounded-full"
										onerror={(e) =>
											((e.target as HTMLElement).style.display =
												'none')} />
									{Number(t.balance) < 0.0001 && Number(t.balance) > 0
										? '<0.0001'
										: Number(t.balance).toFixed(4)}
									{t.symbol}
								</p>
							{/each}
						</div>
					{/if}

					{#if w.error}
						<p class="mb-3 text-red-500">{w.error}</p>
					{/if}

					<div class="flex gap-2">
						<Button onclick={() => w.refresh()} disabled={w.loading}>
							{w.loading ? 'Refreshing...' : 'Refresh'}
						</Button>
						<Button variant="outline" onclick={() => navigate('/settings')}>
							<SettingsIcon size={16} />
						</Button>
						<Button variant="outline" onclick={async () => { await w.logout(); navigate('/') }}>
							Logout
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Transactions</CardTitle>
				</CardHeader>
				<CardContent>
					{#if !w.apiKey}
						<div class="flex gap-2 items-center">
							<input
								class="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 font-mono text-xs"
								placeholder="Alchemy API key"
								bind:value={apiKeyInput} />
							<Button
								size="sm"
								onclick={() => w.saveApiKey(apiKeyInput)}
								disabled={!apiKeyInput.trim()}>
								Save
							</Button>
						</div>
					{:else if w.transactions.length === 0}
						<p class="text-muted-foreground text-xs">
							No transactions found
						</p>
					{:else}
						<div class="max-h-96 space-y-1 overflow-y-auto">
							{#each w.transactions as tx}
								<button
									onclick={() =>
										navigate('/tx/:chainid/:hash', {
											params: {
												chainid: w.chainid,
												hash: tx.hash,
											},
										})}
									class="flex w-full cursor-pointer items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-left hover:bg-muted/80 transition-colors">
									<div class="shrink-0 mt-0.5 {tx.from.toLowerCase() === w.address.toLowerCase() ? 'text-muted-foreground' : 'text-green-500'}">
										{#if tx.from.toLowerCase() === w.address.toLowerCase()}
											<ArrowUp size={16} />
										{:else}
											<ArrowDown size={16} />
										{/if}
									</div>
									<div class="min-w-0 flex-1 space-y-0.5">
										<p class="font-medium">
											{txAction(tx, w.address)}
										</p>
										<p
											class="flex items-center gap-1 text-muted-foreground font-mono">
											{#if tx.pairedValue}
												<img
													src={nativeIcon(w.network)}
													alt=""
													class="size-3.5 rounded-full"
													onerror={(e) =>
														((e.target as HTMLElement).style.display =
															'none')} />
												{Number(tx.value).toFixed(4)}
												{w.symbol}
												<span class="mx-0.5">→</span>
												<img
													src={tx.pairedLogo || tokenIcon(
														w.network,
														tx.contractAddress,
													)}
													alt=""
													class="size-3.5 rounded-full"
													onerror={(e) =>
														((e.target as HTMLElement).style.display =
															'none')} />
												{Number(tx.pairedValue).toFixed(4)}
												{tx.pairedSymbol}
											{:else if tx.tokenSymbol}
												<img
													src={tx.logo || tokenIcon(
														w.network,
														tx.contractAddress,
													)}
													alt=""
													class="size-3.5 rounded-full"
													onerror={(e) =>
														((e.target as HTMLElement).style.display =
															'none')} />
												{Number(tx.value).toFixed(4)}
												{tx.tokenSymbol}
											{:else}
												<img
													src={nativeIcon(w.network)}
													alt=""
													class="size-3.5 rounded-full"
													onerror={(e) =>
														((e.target as HTMLElement).style.display =
															'none')} />
												{Number(tx.value).toFixed(4)}
												{w.symbol}
											{/if}
										</p>
										<p class="text-muted-foreground">
											{new Date(
												Number(tx.timeStamp) * 1000,
											).toLocaleDateString('en-US', {
												year: 'numeric',
												month: 'short',
												day: 'numeric',
												hour: '2-digit',
												minute: '2-digit',
											})}
										</p>
										<p
											class="text-muted-foreground/50 truncate font-mono">
											{tx.hash.slice(0, 10)}...
										</p>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</CardContent>
			</Card>
		</div>
	{/if}
