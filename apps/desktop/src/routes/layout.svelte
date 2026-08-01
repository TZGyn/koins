<script lang="ts">
	import { route } from 'sv-router/generated'
	import { session } from '$lib/states/session.svelte.js'
	import { xrpWallet } from '$lib/states/xrp-wallet.svelte.js'
	import { moneroWallet } from '$lib/states/monero-wallet.svelte.js'
	import { Button } from '$lib/components/ui/button/index.js'
	import House from '@lucide/svelte/icons/house'
	import SettingsIcon from '@lucide/svelte/icons/settings'
	import Fingerprint from '@lucide/svelte/icons/fingerprint'
	import LockIcon from '@lucide/svelte/icons/lock'

	let { children } = $props()

	const title = $derived.by(() => {
		const p = route.pathname
		if (p === '/') return 'Koins'
		if (p === '/settings') return 'Settings'
		if (p.startsWith('/xrp/tx/')) return 'Transaction'
		if (p === '/xrp/send') return 'Send'
		if (p.startsWith('/xrp')) return 'XRP'
		if (p.startsWith('/monero/tx/')) return 'Transaction'
		if (p === '/monero/send') return 'Send'
		if (p === '/monero/settings') return 'Monero Settings'
		if (p.startsWith('/monero')) return 'Monero'
		return 'Koins'
	})

	const handleUnlock = async () => {
		const ok = await session.unlock()
		if (!ok) return
		if (!xrpWallet.ready) await xrpWallet.init()
		if (!moneroWallet.ready) await moneroWallet.init()
		await Promise.allSettled([
			xrpWallet.autoUnlock(),
			moneroWallet.login(),
		])
	}

	const itemClass = (active: boolean) =>
		`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
			active
				? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
				: 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
		}`
</script>

{#if !session.unlocked}
	<div
		class="flex h-screen w-screen flex-col items-center justify-center bg-background gap-6">
		<div class="flex flex-col items-center gap-4">
			<div
				class="flex size-16 items-center justify-center rounded-full bg-muted">
				<Fingerprint size={32} class="text-muted-foreground" />
			</div>
			<div class="text-center">
				<p class="text-lg font-semibold">Koins</p>
				<p class="text-sm text-muted-foreground">
					Use Touch ID to unlock
				</p>
			</div>
		</div>

		{#if session.biometricAvailable}
			<Button
				onclick={handleUnlock}
				size="lg"
				class="gap-2"
				disabled={session.unlocking}>
				<Fingerprint size={18} />
				{session.unlocking ? 'Unlocking...' : 'Unlock'}
			</Button>
		{:else}
			<p class="text-sm text-muted-foreground max-w-xs text-center">
				Biometric authentication isn't available on this device.
			</p>
		{/if}

		{#if session.error}
			<p class="text-sm text-destructive">{session.error}</p>
		{/if}
	</div>
{:else}
	<div class="flex h-screen w-screen overflow-hidden">
		<aside class="flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
			<div class="px-3 pt-9">
				<p class="px-2 pb-4 text-sm font-semibold">Koins</p>
			</div>

			<div class="flex-1 overflow-y-auto px-3">
				<nav class="space-y-0.5">
					<a href="/" class={itemClass(route.pathname === '/')}>
						<House size={16} class="shrink-0" />
						<span>Home</span>
					</a>
				</nav>

				<p
					class="mb-1 mt-4 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
					Wallets
				</p>

				<nav class="space-y-0.5">
					<a href="/xrp" class={itemClass(route.pathname.startsWith('/xrp'))}>
						<img
							src="/icons/xrp.png"
							alt=""
							class="size-4 shrink-0 rounded-full" />
						<span>XRP</span>
					</a>
					<a
						href="/monero"
						class={itemClass(route.pathname.startsWith('/monero'))}>
						<img
							src="/icons/monero.png"
							alt=""
							class="size-4 shrink-0 rounded-full" />
						<span>Monero</span>
					</a>
				</nav>
			</div>

			<div class="border-t border-sidebar-border px-3 pb-4 pt-2 space-y-0.5">
				<a
					href="/settings"
					class={itemClass(route.pathname === '/settings')}>
					<SettingsIcon size={16} class="shrink-0" />
					<span>Settings</span>
				</a>
				<button
					onclick={() => session.lock()}
					class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors">
					<LockIcon size={16} class="shrink-0" />
					<span>Lock</span>
				</button>
			</div>
		</aside>

		<div class="flex min-w-0 flex-1 flex-col">
			<header
				class="relative flex h-12 shrink-0 items-center border-b border-border px-3">
				<div
					class="pointer-events-none absolute inset-0 flex items-center justify-center">
					<span class="text-sm font-medium">{title}</span>
				</div>
			</header>

			<main class="min-h-0 min-w-0 flex-1 overflow-y-auto">
				<div class="mx-auto w-full max-w-5xl px-6 pt-6 pb-6 lg:px-10">
					{@render children?.()}
				</div>
			</main>
		</div>
	</div>
{/if}