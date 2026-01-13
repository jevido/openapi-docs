<script>
	import * as Card from '$lib/components/ui/card/index.js';
	import { getSchemas, getSpecMeta } from '$lib/api/openapi.js';

	let { data } = $props();

	const spec = $derived(data?.spec ?? null);
	const errorMessage = $derived(data?.error ?? null);
	const meta = $derived(spec ? getSpecMeta(spec) : null);
	const schemas = $derived(spec ? getSchemas(spec) : []);
</script>

<svelte:head>
	<title>{meta?.title ?? 'Schemas'}</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-5xl flex-col gap-6">
	{#if errorMessage}
		<Card.Root class="border-destructive/40">
			<Card.Header>
				<Card.Title>Unable to load the API spec</Card.Title>
				<Card.Description>{errorMessage}</Card.Description>
			</Card.Header>
		</Card.Root>
	{:else if schemas.length === 0}
		<Card.Root>
			<Card.Content class="py-8 text-center text-sm text-muted-foreground">
				No schemas were found in components.schemas.
			</Card.Content>
		</Card.Root>
	{:else}
		{#each schemas as schema}
			<Card.Root class="border-border/70 bg-card/70 backdrop-blur">
				<Card.Header>
					<Card.Title class="text-base">{schema.name}</Card.Title>
					<Card.Description>{schema.schema?.description ?? 'Schema'}</Card.Description>
				</Card.Header>
				<Card.Content>
					<pre class="max-h-96 overflow-auto rounded-md border border-border/60 bg-muted/60 p-4 font-mono text-xs text-foreground">
{JSON.stringify(schema.schema, null, 2)}
					</pre>
				</Card.Content>
			</Card.Root>
		{/each}
	{/if}
</div>
