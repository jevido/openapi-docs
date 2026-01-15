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

	let query = $state('');

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
</script>

<svelte:window onkeydown={handleKeydown} />

<Command.Dialog bind:open={$commandMenuOpen}>
	<Command.Input placeholder="Search docs or endpoints..." bind:value={query} />
	<Command.List>
		<Command.Empty>No results found.</Command.Empty>

		<Command.Group heading="Navigation">
			<Command.Item value="Home" onclick={() => handleNavigate('/')}>Home</Command.Item>
			<Command.Item value="Current page" onclick={() => handleNavigate(page.url.pathname)}>
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
					Switch to: {source.name}
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
					{item.tag}
				</Command.Item>
			{/each}
		</Command.Group>

		<Command.Separator />

		{#each tagItems as item (item.tag)}
			<Command.Group heading={item.tag}>
				{#each item.endpoints as endpoint (endpoint.key)}
					<Command.Item value={endpoint.value} onclick={() => handleNavigate(endpoint.url)}>
						{endpoint.label}
					</Command.Item>
				{/each}
			</Command.Group>
		{/each}
	</Command.List>
</Command.Dialog>
