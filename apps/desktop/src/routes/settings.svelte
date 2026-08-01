<script lang="ts">
	import { xrpWallet } from '$lib/states/xrp-wallet.svelte.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle,
	} from '$lib/components/ui/card/index.js'
	import { navigate } from 'sv-router/generated'

	const w = xrpWallet
	let confirm = $state(false)
	let resetting = $state(false)

	async function handleReset() {
		resetting = true
		const ok = await w.resetApp()
		if (ok) navigate('/')
		resetting = false
		confirm = false
	}
</script>

<div class="mx-auto max-w-xl">
	<Card>
		<CardHeader>
			<CardTitle>Settings</CardTitle>
			<CardDescription>App preferences and data management</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			<div>
				<p class="font-medium text-xs">Reset App</p>
				<p class="text-muted-foreground text-xs mt-1">
					Removes all wallets and seeds from the keychain. You can
					then set up the wallet fresh.
				</p>
				<div class="mt-3">
					{#if confirm}
						<div class="flex gap-2 items-center">
							<p class="text-xs text-red-500">Are you sure?</p>
							<Button size="sm" variant="destructive" onclick={handleReset} disabled={resetting}>
								{resetting ? 'Resetting...' : 'Yes, reset everything'}
							</Button>
							<Button size="sm" variant="outline" onclick={() => (confirm = false)}>
								Cancel
							</Button>
						</div>
					{:else}
						<Button variant="outline" onclick={() => (confirm = true)}>
							Reset App
						</Button>
					{/if}
				</div>
			</div>
		</CardContent>
	</Card>
</div>