<script>
	import { Command as CommandPrimitive } from 'bits-ui';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { cn } from '$lib/utils.js';

	let { ref = $bindable(null), class: className, value = $bindable(''), ...restProps } = $props();
</script>

<div class="border-b border-border/60 p-2" data-slot="command-input-wrapper">
	<div class="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2.5 py-1">
		<SearchIcon class="size-4 shrink-0 text-muted-foreground" />
		<CommandPrimitive.Input
			data-slot="command-input"
			class={cn(
				'flex h-7 w-full rounded-md bg-transparent text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
				className
			)}
			bind:ref
			{...restProps}
			bind:value
		/>
	</div>
</div>
