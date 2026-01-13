<script>
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { getOperations, getSpecMeta } from '$lib/api/openapi.js';

	let { data } = $props();

	const spec = $derived(data?.spec ?? null);
	const errorMessage = $derived(data?.error ?? null);
	const meta = $derived(spec ? getSpecMeta(spec) : null);
	const operations = $derived(spec ? getOperations(spec) : []);

	let query = $state('');

	const filteredOperations = $derived.by(() => {
		if (!query.trim()) return operations;
		const needle = query.trim().toLowerCase();
		return operations.filter((operation) => {
			return (
				operation.path.toLowerCase().includes(needle) ||
				operation.summary.toLowerCase().includes(needle) ||
				operation.operationId.toLowerCase().includes(needle) ||
				operation.tags.some((tag) => tag.toLowerCase().includes(needle))
			);
		});
	});

	const groupedOperations = $derived.by(() => groupByTag(filteredOperations));

	function groupByTag(operationsList) {
		const map = new Map();
		for (const operation of operationsList) {
			const tag = operation.tags[0] ?? 'default';
			if (!map.has(tag)) map.set(tag, []);
			map.get(tag).push(operation);
		}
		return Array.from(map.entries()).map(([tag, entries]) => ({
			tag,
			operations: entries
		}));
	}

	function methodVariant(method) {
		switch (method) {
			case 'get':
				return 'secondary';
			case 'post':
				return 'default';
			case 'delete':
				return 'destructive';
			default:
				return 'outline';
		}
	}
</script>

<svelte:head>
	<title>{meta?.title ?? 'API Reference'}</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-5xl flex-col gap-6">
	{#if errorMessage}
		<Card.Root class="border-destructive/40">
			<Card.Header>
				<Card.Title>Unable to load the API spec</Card.Title>
				<Card.Description>{errorMessage}</Card.Description>
			</Card.Header>
		</Card.Root>
	{:else}
		<Card.Root class="border-border/70 bg-card/70 backdrop-blur">
			<Card.Header class="flex flex-col gap-2">
				<Card.Title class="text-2xl">API Reference</Card.Title>
				<Card.Description>
					Browse endpoints by tag or pick one from the sidebar.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<Input placeholder="Search endpoints, tags, or operation ids" bind:value={query} />
			</Card.Content>
		</Card.Root>

		{#if groupedOperations.length === 0}
			<Card.Root>
				<Card.Content class="py-8 text-center text-sm text-muted-foreground">
					No endpoints match your search.
				</Card.Content>
			</Card.Root>
		{:else}
			{#each groupedOperations as group}
				<Card.Root class="border-border/70 bg-card/70 backdrop-blur">
					<Card.Header class="pb-2">
						<Card.Title class="text-base">{group.tag}</Card.Title>
						<Card.Description>{group.operations.length} endpoints</Card.Description>
					</Card.Header>
					<Card.Content class="grid gap-2">
						{#each group.operations as operation}
							<div class="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-muted/40 px-3 py-2">
								<Badge variant={methodVariant(operation.method)}>
									{operation.method.toUpperCase()}
								</Badge>
								<div class="flex min-w-0 flex-1 flex-col">
									<span class="truncate text-sm font-medium">
										{operation.summary}
									</span>
									<span class="truncate text-xs text-muted-foreground">{operation.path}</span>
								</div>
								<Button
									size="sm"
									variant="outline"
									href={`/reference/${encodeURIComponent(operation.operationId)}`}
								>
									View
								</Button>
							</div>
						{/each}
					</Card.Content>
				</Card.Root>
			{/each}
		{/if}
	{/if}
</div>
