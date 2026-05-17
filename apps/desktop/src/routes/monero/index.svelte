<script lang="ts">
	import { wallet, atomicToXmr, type NetworkId } from '$lib/states/wallet.svelte.js'
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
	import ArrowDown from '@lucide/svelte/icons/arrow-down'
	import ArrowUp from '@lucide/svelte/icons/arrow-up'
	import { navigate } from 'sv-router/generated'

	const w = wallet

	function navTarget(id: NetworkId): string {
		if (id === 'eth') return '/'
		return `/${id}`
	}

	let moneroWalletName = $state('')
	let moneroWalletPass = $state('')
	let moneroMnemonic = $state('')
	let moneroRestoreHeight = $state<number | undefined>(undefined)
	let moneroSelectedWallet = $state('')
	let moneroSelectedWalletPass = $state('')

	let initStarted = false
	$effect(() => {
		if (!initStarted) {
			initStarted = true
			w.init().then(() => w.switchNetwork('monero'))
		}
	})
</script>

<div class="mx-auto mt-16 max-w-md">
	<div class="flex flex-col gap-4">
		<div class="flex gap-1 justify-center" role="group">
			{#each w.networks as net}
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

		<!-- MONERO DASHBOARD -->
		{#if w.moneroDownloading}
			<Card>
				<CardContent>
					<p class="text-muted-foreground text-xs">Downloading Monero binary (70MB)...</p>
				</CardContent>
			</Card>
		{:else if !w.moneroInstalled}
			<Card>
				<CardHeader>
					<CardTitle>Monero Setup</CardTitle>
					<CardDescription>Download monero-wallet-rpc to get started</CardDescription>
				</CardHeader>
				<CardContent>
					<Button onclick={() => w.moneroDownload()}>Download (~70MB)</Button>
				</CardContent>
			</Card>
		{:else if !w.moneroRunning}
			<Card>
				<CardHeader>
					<CardTitle>Monero Wallet</CardTitle>
					<CardDescription>Start the wallet RPC server to connect to the Monero network</CardDescription>
				</CardHeader>
				<CardContent>
					<Button onclick={() => w.moneroStart()} disabled={w.loading}>
						{w.loading ? 'Starting...' : 'Start'}
					</Button>
				</CardContent>
			</Card>
		{:else if !w.moneroWalletOpen}
			<Card>
				<CardHeader>
					<CardTitle>Monero Wallet</CardTitle>
					<CardDescription>
						{w.moneroWallets.length > 0
							? `${w.moneroWallets.length} wallet${w.moneroWallets.length > 1 ? 's' : ''} found on disk`
							: 'No existing wallets found'}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="flex flex-col gap-3">
						{#if w.moneroWallets.length > 0}
							<p class="text-xs font-medium">Select a wallet to open:</p>
							<div class="flex flex-wrap gap-2">
								{#each w.moneroWallets as name}
									<Button
										variant={moneroSelectedWallet === name ? 'default' : 'outline'}
										onclick={() => { moneroSelectedWallet = name; moneroSelectedWalletPass = '' }}
									>
										{name}
									</Button>
								{/each}
							</div>
							{#if moneroSelectedWallet}
								<div class="flex gap-2 items-end">
									<Input
										type="password"
										placeholder="Enter password"
										bind:value={moneroSelectedWalletPass}
									/>
									<Button
										onclick={() => w.moneroOpenExistingWallet(moneroSelectedWallet, moneroSelectedWalletPass)}
										disabled={w.loading || !moneroSelectedWalletPass}
									>
										Open
									</Button>
								</div>
							{/if}
							<hr class="border-muted" />
						{/if}
						<p class="text-xs text-muted-foreground">Or create a new wallet:</p>
						<Input placeholder="Wallet name" bind:value={moneroWalletName} />
						<Input type="password" placeholder="Password" bind:value={moneroWalletPass} />
						<div class="flex gap-2">
							<Button
								onclick={async () => {
									const result = await w.moneroCreateWallet(moneroWalletName, moneroWalletPass)
									moneroMnemonic = result.mnemonic
								}}
								disabled={w.loading || !moneroWalletName || !moneroWalletPass}>
								Create Wallet
							</Button>
						</div>
						<hr class="border-muted" />
						<p class="text-xs text-muted-foreground">Restore from seed</p>
						<Textarea placeholder="Enter your Monero seed phrase (16 or 25 words)" bind:value={moneroMnemonic} />
						<Input type="number" placeholder="Restore height (optional)" bind:value={moneroRestoreHeight} />
						<Button
							onclick={() => w.moneroRestoreWallet(moneroWalletName, moneroWalletPass, moneroMnemonic, moneroRestoreHeight)}
							disabled={w.loading || !moneroWalletName || !moneroWalletPass || !moneroMnemonic.trim()}>
							Restore Wallet
						</Button>
					</div>
				</CardContent>
			</Card>
		{:else}
			<!-- Monero wallet unlocked -->
			<Card>
				<CardHeader>
					<div class="flex items-center justify-between">
						<CardTitle>Monero Wallet</CardTitle>
						<div class="flex items-center gap-1.5">
							<div class="size-2 rounded-full {w.moneroConnected ? 'bg-green-500' : 'bg-red-500'}"></div>
							<span class="text-xs text-muted-foreground">{w.moneroConnected ? 'Connected' : 'Disconnected'}</span>
						</div>
					</div>
					<CardDescription>
						{#if w.moneroHeight < w.moneroDaemonHeight}
							Scanning: {w.moneroHeight.toLocaleString()} / {w.moneroDaemonHeight.toLocaleString()}
						{:else}
							Height: {w.moneroHeight.toLocaleString()}
						{/if}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="mb-4 space-y-1">
						<p class="font-medium text-xs">Address</p>
						<p class="font-mono text-xs break-all">{w.moneroAddress}</p>
						<p class="mt-2 font-medium text-xs">Balance</p>
						<p class="font-mono text-lg">{w.moneroBalance} XMR</p>
						{#if w.moneroUnlockedAtomic !== w.moneroBalAtomic}
							<p class="text-xs text-muted-foreground">
								Unlocked: {w.moneroUnlocked} XMR
							</p>
						{/if}
					</div>

					{#if moneroMnemonic}
						<div class="mb-4 rounded-md bg-muted p-3">
							<p class="text-xs font-medium mb-1">Seed phrase (save this!)</p>
							<p class="font-mono text-xs break-all">{moneroMnemonic}</p>
						</div>
					{/if}

					<div class="flex gap-2">
						<Button onclick={() => { w.moneroRefresh(); w.moneroFetchAccounts(); }} disabled={w.loading}>
							{w.loading ? 'Refreshing...' : 'Refresh'}
						</Button>
						<Button variant="outline" onclick={() => w.moneroStop()}>
							Stop
						</Button>
					</div>
				</CardContent>
			</Card>

			<!-- Monero transactions -->
			<Card>
				<CardHeader>
					<CardTitle>Transactions</CardTitle>
				</CardHeader>
				<CardContent>
					{#if w.moneroTxs.length === 0}
						<p class="text-muted-foreground text-xs">No transactions found</p>
					{:else}
						<div class="max-h-96 space-y-1 overflow-y-auto">
							{#each w.moneroTxs as tx}
								<div class="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs">
									<div class="shrink-0 mt-0.5 {tx.direction === 'in' ? 'text-green-500' : 'text-muted-foreground'}">
										{#if tx.direction === 'in'}
											<ArrowDown size={16} />
										{:else}
											<ArrowUp size={16} />
										{/if}
									</div>
									<div class="min-w-0 flex-1 space-y-0.5">
										<p class="font-medium">
											{tx.direction === 'in' ? 'Received' : 'Sent'}
										</p>
										<p class="font-mono text-muted-foreground">
											{atomicToXmr(tx.amount)} XMR
										</p>
										{#if tx.timestamp && tx.timestamp !== '0'}
											<p class="text-muted-foreground">{new Date(Number(tx.timestamp) * 1000).toLocaleString()}</p>
										{/if}
										<p class="text-muted-foreground/50 truncate font-mono">
											{tx.hash.slice(0, 12)}...
										</p>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</CardContent>
			</Card>

			<!-- Monero accounts & subaddresses -->
			<Card>
				<CardHeader>
					<CardTitle>Accounts & Addresses</CardTitle>
					<CardDescription>
						{w.moneroAccounts.length} account{w.moneroAccounts.length !== 1 ? 's' : ''}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{#each w.moneroAccounts as account}
						<div class="mb-3 rounded-md bg-muted p-3">
							<div class="mb-1 flex items-center justify-between">
								<p class="text-xs font-medium">Account {account.index}</p>
								<p class="text-xs text-muted-foreground">
									{atomicToXmr(account.balance)} XMR
								</p>
							</div>
							<p class="mb-2 font-mono text-xs text-muted-foreground break-all">
								{account.primaryAddress}
							</p>
							{#if account.subaddresses.length > 1}
								<div class="space-y-1 border-t border-border pt-2">
									<p class="text-xs text-muted-foreground mb-1">Subaddresses</p>
									{#each account.subaddresses as sub}
										<div class="rounded-sm bg-background px-2 py-1.5 text-xs">
											<div class="flex items-center justify-between">
												<p class="font-medium">#{sub.index}{sub.label ? ` - ${sub.label}` : ''}</p>
												<p class="text-muted-foreground">{atomicToXmr(sub.balance)} XMR</p>
											</div>
											<p class="font-mono text-muted-foreground/50 truncate">{sub.address}</p>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</CardContent>
			</Card>
		{/if}
	</div>
</div>
