<script lang="ts">
	import QRCode from 'qrcode'

	let { text, size = 128 }: { text: string; size?: number } = $props()

	let dataUrl = $state('')

	$effect(() => {
		if (!text) return
		QRCode.toDataURL(text, {
			width: size,
			margin: 1,
			color: { dark: '#000', light: '#fff' },
		}).then((url) => {
			dataUrl = url
		})
	})
</script>

{#if dataUrl}
	<img src={dataUrl} alt="QR code" {width} {height} class="rounded-md" />
{/if}
