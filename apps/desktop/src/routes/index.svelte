<script lang="ts">
	import { electrobun, type TxEntry } from '$lib/electrobun.js'
	import { Wallet } from '$lib/states/wallet.svelte.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import { Textarea } from '$lib/components/ui/textarea/index.js'
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from '$lib/components/ui/card/index.js'
	import { formatEther, formatUnits } from 'ethers'

	const CDN = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains'

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

	const SELECTORS: Record<string, string> = {
		'0x': 'Send',
		'0xa9059cbb': 'Transfer',
		'0x095ea7b3': 'Approve',
		'0x23b872dd': 'TransferFrom',
		'0x38ed1739': 'Swap',
		'0x7ff36ab5': 'Swap',
		'0x18cbafe5': 'Swap',
		'0x022c0d9f': 'Swap',
		'0x3593564c': 'Swap',
		'0x49404b7c': 'Swap',
		'0x414bf389': 'Swap',
	}

	function txAction(tx: TxEntry, address: string): string {
		if (tx.pairedValue) return 'Swap'
		const dir = tx.from.toLowerCase() === address.toLowerCase() ? 'Sent' : 'Received'
		if (tx.tokenSymbol) return `${dir} ${tx.tokenSymbol}`
		const sel = tx.input?.slice(0, 10) ?? '0x'
		return SELECTORS[sel] ?? 'Contract Interaction'
	}

	let w = Wallet()
	let inputSeed = $state('')
	let apiKeyInput = $state('')

	$effect(() => {
		w.init()
	})
</script>

<div class="mx-auto mt-16 max-w-md">
	{#if !w.ready}
		<!-- loading -->
	{:else if !w.vaultExists}
		<Card>
			<CardHeader>
				<CardTitle>Import Wallet</CardTitle>
				<CardDescription>
					Enter your seed phrase to save it securely in your system
					keychain
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="flex flex-col gap-3">
					<Textarea
						placeholder="Enter your 12 or 24 word seed phrase"
						bind:value={inputSeed} />
					<Button
						onclick={() => w.saveVault(inputSeed)}
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
			<CardContent>
				<p class="text-muted-foreground text-xs">Unlocking...</p>
			</CardContent>
		</Card>
	{:else}
		<div class="flex flex-col gap-4">
			<Card>
				<CardHeader>
					<div class="flex items-center justify-between">
						<div>
							<CardTitle>Wallet</CardTitle>
							<CardDescription>
								Your wallet is unlocked
							</CardDescription>
						</div>
						<div class="flex gap-1" role="group">
							{#each w.networks as net}
								<button
									class="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors {w.network ===
									net.id
										? 'bg-primary text-primary-foreground'
										: 'bg-muted text-muted-foreground hover:bg-muted/80'}"
									onclick={() => w.switchNetwork(net.id)}>
									{net.name}
								</button>
							{/each}
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{#if w.address}
						<div class="mb-4 space-y-1">
							<p class="font-medium text-xs">Address</p>
							<p class="font-mono text-xs break-all">{w.address}</p>
							<p class="mt-2 font-medium text-xs">
								{w.symbol} Balance
							</p>
							<p class="flex items-center gap-1.5 font-mono text-lg">
								<img
									src={nativeIcon(w.network)}
									alt=""
									class="size-4 rounded-full"
									onerror={(e) => (e.target as HTMLElement).style.display = 'none'} />
								{w.balance} {w.symbol}
							</p>
						</div>
						<div class="mb-4 space-y-1">
							<p class="font-medium text-xs">Tokens</p>
							{#each w.tokenBalances as t}
								<p class="flex items-center gap-1.5 font-mono text-sm">
									<img
										src={tokenIcon(w.network, t.address)}
										alt=""
										class="size-4 rounded-full"
										onerror={(e) => (e.target as HTMLElement).style.display = 'none'} />
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
						<Button variant="outline" onclick={() => w.lock()}>
							Lock
						</Button>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Transactions</CardTitle>
				</CardHeader>
				<CardContent>
					{#if !w.etherscanKey}
						<div class="flex gap-2 items-center">
							<input
								class="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 font-mono text-xs"
								placeholder="Etherscan API key"
								bind:value={apiKeyInput} />
							<Button
								size="sm"
								onclick={() => w.saveEtherscanKey(apiKeyInput)}
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
								<div
									class="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-xs">
									<div class="min-w-0 flex-1 space-y-0.5">
										<p>
											<button
												onclick={() => electrobun.rpc?.request.openExternal({ url: w.explorerUrl + tx.hash })}
												class="hover:underline cursor-pointer font-medium">
												{txAction(tx, w.address)}
											</button>
										</p>
										<p class="flex items-center gap-1 text-muted-foreground font-mono">
											{#if tx.pairedValue}
												<img src={nativeIcon(w.network)} alt="" class="size-3.5 rounded-full" onerror={(e) => (e.target as HTMLElement).style.display = 'none'} />
												{Number(formatEther(tx.value)).toFixed(4)} {w.symbol}
												<span class="mx-0.5">→</span>
												<img src={tokenIcon(w.network, tx.contractAddress)} alt="" class="size-3.5 rounded-full" onerror={(e) => (e.target as HTMLElement).style.display = 'none'} />
												{Number(formatUnits(tx.pairedValue, Number(tx.pairedDecimals ?? 18))).toFixed(4)} {tx.pairedSymbol}
											{:else if tx.tokenSymbol}
												<img src={tokenIcon(w.network, tx.contractAddress)} alt="" class="size-3.5 rounded-full" onerror={(e) => (e.target as HTMLElement).style.display = 'none'} />
												{Number(formatUnits(tx.value, Number(tx.tokenDecimal ?? 18))).toFixed(4)} {tx.tokenSymbol}
											{:else}
												<img src={nativeIcon(w.network)} alt="" class="size-3.5 rounded-full" onerror={(e) => (e.target as HTMLElement).style.display = 'none'} />
												{Number(formatEther(tx.value)).toFixed(4)} {w.symbol}
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
										<p class="text-muted-foreground/50 truncate font-mono">
											<button
												onclick={() => electrobun.rpc?.request.openExternal({ url: w.explorerUrl + tx.hash })}
												class="hover:underline cursor-pointer">
												{tx.hash.slice(0, 10)}...
											</button>
										</p>
									</div>
									{#if !tx.tokenSymbol || tx.pairedValue}
										<span
											class="ml-2 shrink-0 {tx.isError === '0' ? 'text-green-500' : 'text-red-500'}">
											{tx.isError === '0' ? '✓' : '✗'}
										</span>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</CardContent>
			</Card>
		</div>
	{/if}
</div>
