<script lang="ts">
	import LoginForm from '$lib/components/login-form.svelte'
	import { authClient } from '$lib/auth-client'
	import { goto } from '$app/navigation'

	let session = authClient.useSession()

	$effect(() => {
		if ($session.data?.user) {
			goto('/')
		}
	})
</script>

<div
	class="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
	<div class="w-full max-w-sm md:max-w-3xl">
		<LoginForm />
	</div>
</div>
