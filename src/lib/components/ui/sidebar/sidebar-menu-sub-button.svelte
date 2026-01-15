<script>
	import { cn } from '$lib/utils.js';
	let {
		ref = $bindable(null),
		children,
		child,
		class: className,
		size = 'md',
		isActive = false,
		...restProps
	} = $props();

	const mergedProps = $derived({
		class: cn(
			'text-sidebar-foreground ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:bg-sidebar-accent active:text-sidebar-accent-foreground [&>svg]:text-sidebar-accent-foreground flex min-h-[1.75rem] min-w-0 -translate-x-px items-start gap-2 rounded-md px-2 py-1.5 text-pretty leading-snug outline-hidden focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0',
			'data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground',
			size === 'sm' && 'text-xs',
			size === 'md' && 'text-sm',
			'group-data-[collapsible=icon]:hidden',
			className
		),
		'data-slot': 'sidebar-menu-sub-button',
		'data-sidebar': 'menu-sub-button',
		'data-size': size,
		'data-active': isActive,
		...restProps
	});
</script>

{#if child}
	{@render child({ props: mergedProps })}
{:else}
	<a bind:this={ref} {...mergedProps}>
		{@render children?.()}
	</a>
{/if}
