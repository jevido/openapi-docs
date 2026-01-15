<script>
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import Markdown from '$lib/components/markdown.svelte';
	import { activeOpenApiSource, openapiSpecs, openapiStatus } from '$lib/stores/openapi.js';

	const servers = $derived.by(() => $openapiSpecs?.servers ?? []);
	const specUrl = $derived.by(() => $activeOpenApiSource?.url ?? '');
	const openApiVersion = $derived.by(() => $openapiSpecs?.openapi ?? '—');
	const info = $derived.by(() => $openapiSpecs?.info ?? null);
</script>

{#if $openapiStatus.state === 'error'}
	<Card.Root class="border-destructive/40">
		<Card.Header>
			<Card.Title>Unable to load the API spec</Card.Title>
			<Card.Description>Check the URL or CORS settings for the selected source.</Card.Description>
		</Card.Header>
		<Card.Content>
			<p class="text-sm text-muted-foreground">
				Add an OpenAPI JSON URL from the sidebar menu, or set OPENAPI_LOCATION in your
				environment to replace the default.
			</p>
		</Card.Content>
	</Card.Root>
{:else if info}
	<div class="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
		<div class="space-y-6">
			<Card.Root class="border-muted/40 bg-background/60">
				<Card.Header class="space-y-2">
					<Card.Title class="text-2xl">{info.title || 'API documentation'}</Card.Title>
					<Card.Description>
						{#if info.description}
							<Markdown content={info.description} />
						{:else}
							Explore endpoints, schemas, and authentication details.
						{/if}
					</Card.Description>
				</Card.Header>
				<Card.Content class="flex flex-wrap items-center gap-2">
					<Badge variant="outline">OpenAPI {openApiVersion}</Badge>
					{#if info.version}
						<Badge variant="secondary">v{info.version}</Badge>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root class="border-muted/40 bg-background/60">
				<Card.Header>
					<Card.Title>Specification</Card.Title>
					<Card.Description>The active OpenAPI JSON source.</Card.Description>
				</Card.Header>
				<Card.Content>
					<div class="rounded-lg border border-muted/40 bg-muted/10 px-3 py-2 text-xs">
						{specUrl || 'No OpenAPI source selected.'}
					</div>
				</Card.Content>
			</Card.Root>
		</div>

		<Card.Root class="border-muted/40 bg-background/60">
			<Card.Header>
				<Card.Title>Servers</Card.Title>
				<Card.Description>Available base URLs for this API.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-2">
				{#if servers.length}
					{#each servers as server (server.url)}
						<div class="rounded-lg border border-muted/30 bg-muted/10 px-3 py-2 text-xs">
							<div class="font-medium">{server.url}</div>
							{#if server.description}
								<div class="text-muted-foreground">{server.description}</div>
							{/if}
						</div>
					{/each}
				{:else}
					<p class="text-sm text-muted-foreground">No servers defined in this spec.</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
{:else}
	<Card.Root class="border-muted/40 bg-background/60">
		<Card.Header>
			<Card.Title>Loading documentation</Card.Title>
			<Card.Description>Fetching the OpenAPI spec...</Card.Description>
		</Card.Header>
	</Card.Root>
{/if}
