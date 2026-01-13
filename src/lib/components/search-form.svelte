<script>
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import SearchIcon from '@lucide/svelte/icons/search';
	let { ref = $bindable(null), value = $bindable(''), ...restProps } = $props();
</script>

<form bind:this={ref} {...restProps}>
	<Sidebar.Group class="py-0">
		<Sidebar.GroupContent class="relative">
			<Label for="search" class="sr-only">Search</Label>
			<Sidebar.Input id="search" placeholder="Search the docs..." class="ps-8" bind:value />
			<SearchIcon
				class="pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2 opacity-50 select-none"
			/>
		</Sidebar.GroupContent>
	</Sidebar.Group>
</form>
