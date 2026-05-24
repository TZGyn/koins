<script lang="ts">
	import { moneroWallet, atomicToXmr } from '$lib/states/monero-wallet.svelte.js'
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
	import Fingerprint from '@lucide/svelte/icons/fingerprint'
	import SettingsIcon from '@lucide/svelte/icons/settings'
	import Loader from '$lib/components/loader.svelte'
	import QrCode from '$lib/components/qr.svelte'
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
			<p class="text-center text-muted-foreground text-sm mt-8">Loading...</p>
		{:else if !w.accountType}
			<p class="text-center text-muted-foreground text-sm mt-8">
				<a href="/" class="underline">Go to welcome page</a> to get started
			</p>
		{:else if w.accountType === 'monero'}
			{#if w.downloading}
			<Card>
				<CardContent>
					<p class="text-muted-foreground text-xs">Downloading Monero binary (70MB)...</p>
				</CardContent>
			</Card>
		{:else if !w.installed}
			<Card>
				<CardHeader>
					<CardTitle>Monero Setup</CardTitle>
					<CardDescription>Download monero-wallet-rpc to get started</CardDescription>
				</CardHeader>
				<CardContent>
					<Button onclick={() => w.download()}>Download (~70MB)</Button>
				</CardContent>
			</Card>
		{:else if !w.running}
			<Card>
				<CardHeader>
					<CardTitle>Monero Wallet</CardTitle>
					<CardDescription>Start the wallet RPC server to connect to the Monero network</CardDescription>
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
							<p class="text-xs font-medium">Select a wallet to open:</p>
							<div class="flex flex-wrap gap-2">
								{#each w.wallets as name}
									<Button
										variant={moneroSelectedWallet === name ? 'default' : 'outline'}
										onclick={() => { moneroSelectedWallet = name; moneroSelectedWalletPass = '' }}
									>
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
													await w.openExistingWallet(moneroSelectedWallet)
													if (!w.walletOpen) w.error = 'No password saved for this wallet'
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
											bind:value={moneroSelectedWalletPass}
										/>
										<Button
											onclick={() => w.openExistingWallet(moneroSelectedWallet, moneroSelectedWalletPass)}
											disabled={w.loading || !moneroSelectedWalletPass}
										>
											Open
										</Button>
									</div>
								</div>
							{/if}
							<hr class="border-muted" />
						{/if}
						<p class="text-xs text-muted-foreground">Or create a new wallet:</p>
						<Input placeholder="Wallet name" bind:value={moneroWalletName} />
						{#if w.biometricAvailable}
							<label class="flex items-center gap-2 text-xs cursor-pointer">
								<input type="checkbox" bind:checked={moneroUseBiometric} />
								Save password with Touch ID
							</label>
						{/if}
						{#if !moneroUseBiometric}
							<Input type="password" placeholder="Password" bind:value={moneroWalletPass} />
						{/if}
						<div class="flex gap-2">
							<Button
								onclick={async () => {
									const pw = moneroUseBiometric ? crypto.randomUUID() : moneroWalletPass
									const result = await w.createWallet(moneroWalletName, pw, moneroUseBiometric)
									moneroMnemonic = result.mnemonic
								}}
								disabled={w.loading || !moneroWalletName || (!moneroUseBiometric && !moneroWalletPass)}>
								Create Wallet
							</Button>
						</div>
						<hr class="border-muted" />
						<p class="text-xs text-muted-foreground">Restore from seed</p>
						<Textarea placeholder="Enter your Monero seed phrase (16 or 25 words)" bind:value={moneroMnemonic} />
						<Input type="number" placeholder="Restore height (optional)" bind:value={moneroRestoreHeight} />
						{#if !moneroUseBiometric}
							<Input type="password" placeholder="Password" bind:value={moneroWalletPass} />
						{/if}
						<Button
							onclick={() => w.restoreWallet(moneroWalletName, moneroUseBiometric ? crypto.randomUUID() : moneroWalletPass, moneroMnemonic, moneroRestoreHeight, moneroUseBiometric)}
							disabled={w.loading || !moneroWalletName || (!moneroUseBiometric && !moneroWalletPass) || !moneroMnemonic.trim()}>
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
							<div class="size-2 rounded-full {w.connected ? 'bg-green-500' : 'bg-red-500'}"></div>
							<span class="text-xs text-muted-foreground">{w.connected ? 'Connected' : 'Disconnected'}</span>
						</div>
					</div>
					<CardDescription>
						{#if w.height < w.daemonHeight}
							Scanning: {w.height.toLocaleString()} / {w.daemonHeight.toLocaleString()}
						{:else}
							Height: {w.height.toLocaleString()}
						{/if}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="mb-4 space-y-1">
						<div class="flex items-start gap-3">
							<QrCode text={w.address} size={128} />
							<div class="min-w-0 flex-1 space-y-1">
								<p class="font-medium text-xs">Address</p>
								<p class="font-mono text-xs break-all">{w.address}</p>
							</div>
						</div>
						<p class="mt-2 font-medium text-xs">Balance</p>
						<p class="font-mono text-lg">{w.balance} XMR</p>
						{#if w.unlockedAtomic !== w.balAtomic}
							<p class="text-xs text-muted-foreground">
								Unlocked: {w.unlocked} XMR
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
						<Button onclick={() => { w.refresh(); w.fetchAccounts(); }} disabled={w.loading}>
							{#if w.loading}
								<Loader />
							{/if}
							Refresh
						</Button>
						<Button variant="outline" onclick={() => navigate('/monero/send')}>
							Send
						</Button>
						<Button variant="outline" onclick={() => navigate('/monero/settings')}>
							<SettingsIcon size={16} />
						</Button>
						<Button variant="outline" onclick={async () => { await w.logout(); window.location.href = '/' }}>
							Logout
						</Button>
					</div>
				</CardContent>
			</Card>

			<!-- Monero transactions -->
			<Card>
				<CardHeader>
					<CardTitle>Transactions</CardTitle>
					{#if w.accounts.length > 0}
						<CardDescription>
							<div class="flex flex-wrap gap-1.5 mt-1">
								{#each w.accounts as acct}
									<button
										onclick={() => { w.selectedAccountIndex = acct.index; w.refresh() }}
										class="rounded-md px-2 py-0.5 text-xs transition-colors {w.selectedAccountIndex === acct.index ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}">
										Account {acct.index}
									</button>
								{/each}
							</div>
						</CardDescription>
					{/if}
				</CardHeader>
				<CardContent>
					{#if w.loading}
						<div class="flex justify-center py-4">
							<Loader />
						</div>
					{:else if w.txs.length === 0}
						<p class="text-muted-foreground text-xs">No transactions found</p>
					{:else}
						<div class="max-h-96 space-y-1 overflow-y-auto">
							{#each w.txs as tx}
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
						{w.accounts.length} account{w.accounts.length !== 1 ? 's' : ''}
					</CardDescription>
				</CardHeader>
				<CardContent>
					{#each w.accounts as account}
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
										<div class="flex items-start gap-2">
											<QrCode text={sub.address} size={64} />
											<div class="min-w-0 flex-1">
												<div class="flex items-center justify-between">
													<p class="font-medium">#{sub.index}{sub.label ? ` - ${sub.label}` : ''}</p>
													<p class="text-muted-foreground">{atomicToXmr(sub.balance)} XMR</p>
												</div>
												<p class="font-mono text-muted-foreground/50 truncate mt-0.5">{sub.address}</p>
											</div>
										</div>
									</div>
								{/each}
								</div>
							{/if}
						</div>
					{/each}
				</CardContent>
			</Card>
		{/if}
	{/if}
	</div>
</div>
