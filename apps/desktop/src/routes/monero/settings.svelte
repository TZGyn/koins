<script lang="ts">
	import { wallet } from '$lib/states/wallet.svelte.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import { Input } from '$lib/components/ui/input/index.js'
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from '$lib/components/ui/card/index.js'
	import { navigate } from 'sv-router/generated'
	import Loader from '$lib/components/loader.svelte'

	const w = wallet

	let moneroSettingsPw = $state('')

	$effect(() => {
		w.init()
	})
</script>

<div class="mx-auto mt-16 max-w-md">
	<div class="flex flex-col gap-4">
		<Card>
			<CardHeader>
				<CardTitle>Monero Settings</CardTitle>
				<CardDescription>Server and wallet preferences</CardDescription>
			</CardHeader>
			<CardContent>
				<div class="flex flex-col gap-4">
					<div>
						<p class="text-xs font-medium mb-2">Server</p>
						<Button
							variant="outline"
							size="sm"
							onclick={async () => { await w.moneroStop(); await w.moneroStart() }}
							disabled={w.loading}>
							{#if w.loading}
								<Loader />
							{/if}
							Restart Server
						</Button>
					</div>
					{#if w.biometricAvailable}
						<div>
							<p class="text-xs font-medium mb-2">Save wallet password with Touch ID</p>
							<p class="text-xs text-muted-foreground mb-3">Enter your wallet password to enable biometric unlock</p>
							<div class="flex gap-2 items-end">
								<Input type="password" placeholder="Wallet password" bind:value={moneroSettingsPw} />
								<Button size="sm" onclick={async () => {
									await w.moneroStorePassword(w.moneroWalletName, moneroSettingsPw)
									moneroSettingsPw = ''
									w.error = ''
								}} disabled={!moneroSettingsPw || w.loading}>Save</Button>
							</div>
						</div>
					{:else}
						<p class="text-xs text-muted-foreground">Biometric authentication not available on this device</p>
					{/if}

					<div class="pt-2 border-t border-border">
						<Button variant="outline" size="sm" onclick={() => navigate('/monero')}>
							Back
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	</div>
</div>
