<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import comavicHeader from '$lib/assets/comavic-header.jpeg';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<div class="bg-primary">
	<img src={comavicHeader} alt="COMAVIC" class="mx-auto w-full max-w-2xl" />
</div>
{@render children()}
