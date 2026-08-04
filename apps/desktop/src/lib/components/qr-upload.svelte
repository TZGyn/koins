<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js'
	import Loader from '$lib/components/loader.svelte'
	import QrCodeIcon from '@lucide/svelte/icons/qr-code'
	import { decodeQrFromFile } from '$lib/qr.js'

	let {
		onDecode,
		disabled = false,
	}: {
		onDecode: (text: string) => void
		disabled?: boolean
	} = $props()

	let fileInput: HTMLInputElement
	let busy = $state(false)
	let error = $state('')

	const handleFile = async (e: Event) => {
		const file = (e.target as HTMLInputElement).files?.[0]
		if (!file) return
		busy = true
		error = ''
		try {
			const text = await decodeQrFromFile(file)
			if (!text) throw new Error('No QR code found in the image')
			onDecode(text)
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to read QR code'
		} finally {
			busy = false
			if (fileInput) fileInput.value = ''
		}
	}
</script>

<div class="flex items-center gap-2">
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		class="hidden"
		onchange={handleFile}
		disabled={disabled || busy} />
	<Button
		type="button"
		variant="outline"
		size="sm"
		class="h-7 gap-1.5"
		disabled={disabled || busy}
		onclick={() => fileInput?.click()}>
		{#if busy}
			<Loader class="size-3.5" />
		{:else}
			<QrCodeIcon size={14} />
		{/if}
		Scan QR
	</Button>
	{#if error}
		<span class="text-xs text-red-500">{error}</span>
	{/if}
</div>