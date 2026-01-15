<script>
	import Command from './command.svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	let {
		open = $bindable(false),
		ref = $bindable(null),
		value = $bindable(''),
		title = 'Command Palette',
		description = 'Search for a command to run',
		portalProps,
		children,
		...restProps
	} = $props();
</script>

<Dialog.Root bind:open {...restProps}>
	<Dialog.Header class="sr-only">
		<Dialog.Title>{title}</Dialog.Title>
		<Dialog.Description>{description}</Dialog.Description>
	</Dialog.Header>
	<Dialog.Content
		class="w-full max-w-md overflow-hidden rounded-xl border border-border/70 bg-popover/95 p-0 shadow-2xl backdrop-blur"
		{portalProps}
	>
		<Command
			class="**:data-[slot=command-input-wrapper]:min-h-14 [&_[data-command-group]]:px-1.5 [&_[data-command-group]:not([hidden])_~[data-command-group]]:pt-0 [&_[data-command-input-wrapper]_svg]:h-4 [&_[data-command-input-wrapper]_svg]:w-4 [&_[data-command-input]]:h-8 [&_[data-command-item]]:px-2.5 [&_[data-command-item]]:py-1.5"
			{...restProps}
			bind:value
			bind:ref
			{children}
		/>
	</Dialog.Content>
</Dialog.Root>
