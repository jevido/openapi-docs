<script>
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { getBaseUrl, getOperations, getSchemas, getSpecMeta } from '$lib/api/openapi.js';

	let { data } = $props();

	const spec = $derived(data?.spec ?? null);
	const specUrl = $derived(data?.specUrl ?? null);
	const errorMessage = $derived(data?.error ?? null);

	const meta = $derived(spec ? getSpecMeta(spec) : null);
	const baseUrl = $derived(spec ? getBaseUrl(spec, specUrl) : '');
	const operations = $derived(spec ? getOperations(spec) : []);
	const schemas = $derived(spec ? getSchemas(spec) : []);
</script>

<svelte:head>
	<title>{meta?.title ?? 'API Docs'}</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-5xl flex-col gap-6">
	{#if errorMessage}
		<Card.Root class="border-destructive/40">
			<Card.Header>
				<Card.Title>Unable to load the API spec</Card.Title>
				<Card.Description>{errorMessage}</Card.Description>
			</Card.Header>
			<Card.Content>
				<p class="text-sm text-muted-foreground">
					Set OPENAPI_LOCATION in your environment to the OpenAPI JSON endpoint.
				</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<Card.Root class="border-border/70 bg-card/70 backdrop-blur">
			<Card.Header class="flex flex-col gap-2">
				<div class="flex flex-wrap items-center gap-3">
					<Card.Title class="text-3xl">{meta?.title ?? 'API Reference'}</Card.Title>
					{#if meta?.version}
						<Badge variant="secondary">v{meta.version}</Badge>
					{/if}
				</div>
				<Card.Description>
					{meta?.description || 'Auto-generated from your OpenAPI spec.'}
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-4">
				<div class="flex flex-wrap items-center gap-3">
					{#if baseUrl}
						<Badge variant="outline">Base URL: {baseUrl}</Badge>
					{/if}
					<Badge variant="outline">{operations.length} endpoints</Badge>
					<Badge variant="outline">{schemas.length} schemas</Badge>
				</div>

				<Separator />

				<div class="flex flex-wrap gap-3">
					<Button href="/reference">Browse endpoints</Button>
					<Button variant="outline" href="/schemas">View schemas</Button>
					<Button variant="outline" href="/client">Create a client</Button>
				</div>
			</Card.Content>
		</Card.Root>

		<Card.Root class="border-border/70 bg-card/70 backdrop-blur">
			<Card.Header>
				<Card.Title class="text-base">Spec source</Card.Title>
				<Card.Description>Loaded dynamically at request time.</Card.Description>
			</Card.Header>
			<Card.Content>
				<code class="text-sm text-muted-foreground">{specUrl || 'No URL configured.'}</code>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
