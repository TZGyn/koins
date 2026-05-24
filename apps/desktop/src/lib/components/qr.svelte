<script lang="ts">
	import { electrobun } from '$lib/electrobun.js'

	let { text, size = 128 }: { text: string; size?: number } = $props()

	let svgContent = $state('')

	$effect(() => {
		if (!text || !electrobun.rpc) return
		svgContent = ''
		electrobun.rpc.request
			.generateQrCode({ text, size })
			.then((svg) => {
				svgContent = svg
			})
	})
</script>

{#if svgContent}
	{@html svgContent}
{/if}
