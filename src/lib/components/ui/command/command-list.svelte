<script>
	import { Command as CommandPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils.js';

	let { ref = $bindable(null), class: className, ...restProps } = $props();
</script>

<CommandPrimitive.List
	bind:ref
	data-slot="command-list"
	class={cn('max-h-[280px] scroll-py-1 overflow-x-hidden overflow-y-auto px-1.5 pb-1.5', className)}
	{...restProps}
/>
