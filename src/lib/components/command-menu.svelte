<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { getEndpointsByTag } from '$lib/api/openapi.js';
	import {
		activeOpenApiSource,
		openapiSources,
		openapiSpecs,
		openapiStatus,
		setActiveOpenApiSource
	} from '$lib/stores/openapi.js';
	import { commandMenuOpen } from '$lib/stores/command-menu.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CornerDownLeftIcon from '@lucide/svelte/icons/corner-down-left';
	import HashIcon from '@lucide/svelte/icons/hash';
	import HomeIcon from '@lucide/svelte/icons/home';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import SendIcon from '@lucide/svelte/icons/send';

	let query = $state('');
	const defaultAction = { label: 'Go to page', icon: SendIcon };
	const methodPattern = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)\s/;

	const endpointsByTag = $derived.by(() => {
		if ($openapiStatus.state !== 'ready' || !$openapiSpecs) return {};
		return getEndpointsByTag($openapiSpecs);
	});

	const tagItems = $derived.by(() => {
		const result = [];

		for (const [tag, endpoints] of Object.entries(endpointsByTag)) {
			result.push({
				tag,
				tagUrl: `/${slugify(tag)}`,
				endpoints: endpoints.map((endpoint) => ({
					key: `${endpoint.path}-${endpoint.method}`,
					label: endpoint.summary || `${endpoint.method} ${endpoint.path}`,
					url: `/${slugify(tag)}#${endpoint.path}-${endpoint.method}`,
					value: `${endpoint.method} ${endpoint.path} ${endpoint.summary || ''}`
				}))
			});
		}

		return result;
	});

	function slugify(value) {
		return value.replace(/[^A-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
	}

	function handleNavigate(url) {
		commandMenuOpen.set(false);
		if (!url) return;
		goto(url);
	}

	async function handleSwitchSource(source) {
		commandMenuOpen.set(false);
		await setActiveOpenApiSource(source.id);
		await goto('/');
	}

	function handleKeydown(event) {
		const isModifier = event.ctrlKey || event.metaKey;
		if (!isModifier || event.key.toLowerCase() !== 'k') return;
		event.preventDefault();
		commandMenuOpen.set(true);
	}

	commandMenuOpen.subscribe(() => {
		query = '';
	});

	let value = $state('');

	function actionForValue(current) {
		if (!current) return defaultAction;
		if (current === 'Home' || current === 'Current page') return defaultAction;
		if (current.startsWith('Switch to OpenAPI')) {
			return { label: 'Switch OpenAPI', icon: LayersIcon };
		}
		if (current.startsWith('Tag ')) {
			return { label: 'Go to tag', icon: HashIcon };
		}
		if (methodPattern.test(current)) {
			return { label: 'Go to endpoint', icon: ArrowRightIcon };
		}
		return defaultAction;
	}

	const activeAction = $derived.by(() => actionForValue(value));
</script>

<svelte:window onkeydown={handleKeydown} />

<Command.Dialog bind:open={$commandMenuOpen} bind:value>
	<Command.Input placeholder="Search documentation..." bind:value={query} />
	<Command.List class="border-b border-border/60">
		<Command.Empty>No results found.</Command.Empty>

		<Command.Group heading="Navigation">
			<Command.Item value="Home" onclick={() => handleNavigate('/')}>
				<HomeIcon class="text-muted-foreground" />
				Home
			</Command.Item>
			<Command.Item value="Current page" onclick={() => handleNavigate(page.url.pathname)}>
				<CornerDownLeftIcon class="text-muted-foreground" />
				Current page
			</Command.Item>
		</Command.Group>

		<Command.Separator />

		<Command.Group heading="Switch OpenAPI">
			{#each $openapiSources as source (source.id)}
				<Command.Item
					value={`Switch to OpenAPI ${source.name} ${source.url}`}
					onclick={() => handleSwitchSource(source)}
				>
					<LayersIcon class="text-muted-foreground" />
					<span class="truncate">Switch to: {source.name}</span>
					{#if source.id === $activeOpenApiSource?.id}
						<Command.Shortcut>Active</Command.Shortcut>
					{/if}
				</Command.Item>
			{/each}
		</Command.Group>

		<Command.Separator />

		<Command.Group heading="Tags">
			{#each tagItems as item (item.tag)}
				<Command.Item value={`Tag ${item.tag}`} onclick={() => handleNavigate(item.tagUrl)}>
					<HashIcon class="text-muted-foreground" />
					{item.tag}
				</Command.Item>
			{/each}
		</Command.Group>

		<Command.Separator />

		{#each tagItems as item (item.tag)}
			<Command.Group heading={item.tag}>
				{#each item.endpoints as endpoint (endpoint.key)}
					<Command.Item value={endpoint.value} onclick={() => handleNavigate(endpoint.url)}>
						<ArrowRightIcon class="text-muted-foreground" />
						{endpoint.label}
					</Command.Item>
				{/each}
			</Command.Group>
		{/each}
	</Command.List>
	<div
		class="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
	>
		<div class="flex items-center gap-2">
			<span
				class="inline-flex size-5 items-center justify-center rounded border border-border/70 bg-background text-xs text-foreground"
			>
				<CornerDownLeftIcon class="size-3" />
			</span>
			Escape to close dialog
		</div>
		<div class="flex items-center gap-2">
			<span
				class="inline-flex size-5 items-center justify-center rounded border border-border/70 bg-background text-xs text-foreground"
			>
				<svelte:component this={activeAction.icon} class="size-3" />
			</span>
			{activeAction.label}
		</div>
	</div>
</Command.Dialog>
