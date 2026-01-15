<script>
	import { commandMenuOpen } from '$lib/stores/command-menu.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import SearchIcon from '@lucide/svelte/icons/search';
	let { ref = $bindable(null), value = $bindable(''), ...restProps } = $props();
</script>

<form bind:this={ref} {...restProps}>
	<Sidebar.Group class="py-0">
		<Sidebar.GroupContent class="relative">
			<Label for="command-search" class="sr-only">Search</Label>
			<button
				id="command-search"
				type="button"
				class="flex h-8 w-full items-center rounded-md border border-input bg-background ps-8 pe-3 text-sm text-muted-foreground shadow-xs transition-[color,box-shadow] hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
				onpointerdown={() => commandMenuOpen.set(true)}
				onkeydown={(event) => {
					if (event.key !== 'Enter' && event.key !== ' ') return;
					event.preventDefault();
					commandMenuOpen.set(true);
				}}
			>
				Search the docs...
			</button>
			<SearchIcon
				class="pointer-events-none absolute start-2 top-1/2 size-4 -translate-y-1/2 opacity-50 select-none"
			/>
		</Sidebar.GroupContent>
	</Sidebar.Group>
</form>
