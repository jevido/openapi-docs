<script>
	import { page } from '$app/state';
	import { specs, getEndpointsByTag, getEndpointDoc } from '$lib/api/openapi.js';

	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import SchemaViewer from '$lib/components/schema-viewer.svelte';

	// current route tag
	const currentTag = $derived(page.params.tag);

	// endpoints for this tag
	const endpoints = $derived.by(() => {
		if (!specs || !currentTag) return [];
		console.debug(specs, currentTag, getEndpointsByTag(specs)[currentTag]);
		const allEndpoints = getEndpointsByTag(specs)[currentTag] ?? [];
		// optional: sort by path or method
		return allEndpoints;
	});

	function methodClass(method) {
		switch (method) {
			case 'GET':
				return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
			case 'POST':
				return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
			case 'PUT':
				return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
			case 'PATCH':
				return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
			case 'DELETE':
				return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
			default:
				return 'bg-muted text-muted-foreground';
		}
	}

	function renderType(schema) {
		if (!schema) return '—';
		if (schema.type) return schema.type;
		if (schema.enum) return 'enum';
		return 'object';
	}
</script>

{#if !endpoints?.length}
	<div class="text-muted-foreground">No endpoints found for tag "{currentTag}".</div>
{:else}
	{#each endpoints as endpoint}
		<!-- Anchor for SPA sidebar scrolling -->
		<div id={endpoint.method} class="space-y-4">
			<!-- Header -->
			<div class="flex flex-col gap-2">
				<div class="flex items-center gap-3">
					<Badge variant="outline" class={methodClass(endpoint.method)}>
						{endpoint.method}
					</Badge>
					<h2 class="text-xl font-semibold tracking-tight">{endpoint.path}</h2>
				</div>
				{#if endpoint.summary}
					<p class="text-muted-foreground">{endpoint.summary}</p>
				{/if}
				{#if endpoint.description}
					<p class="text-sm text-muted-foreground">{endpoint.description}</p>
				{/if}
			</div>

			<Separator class="my-4" />

			<!-- Endpoint Doc -->
			{#await Promise.resolve(getEndpointDoc(specs, endpoint.path, endpoint.method)) then doc}
				{#if doc}
					<!-- Parameters -->
					{#if doc.parameters?.length}
						<Card>
							<CardHeader>
								<CardTitle>Parameters</CardTitle>
							</CardHeader>
							<CardContent>
								<Table.Root>
									<Table.Header>
										<Table.Row>
											<Table.Head>Name</Table.Head>
											<Table.Head>In</Table.Head>
											<Table.Head>Type</Table.Head>
											<Table.Head>Required</Table.Head>
											<Table.Head>Description</Table.Head>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{#each doc.parameters as param}
											<Table.Row>
												<Table.Cell class="font-mono text-sm">{param.name}</Table.Cell>
												<Table.Cell>{param.in}</Table.Cell>
												<Table.Cell>{param.schema?.type ?? '—'}</Table.Cell>
												<Table.Cell>{param.required ? 'Yes' : 'No'}</Table.Cell>
												<Table.Cell class="text-muted-foreground">
													{param.description || '—'}
												</Table.Cell>
											</Table.Row>
										{/each}
									</Table.Body>
								</Table.Root>
							</CardContent>
						</Card>

						<Separator class="my-4" />
					{/if}

					<!-- Request Body -->
					{#if doc.requestBodySchema}
						<Card>
							<CardHeader>
								<CardTitle>Request Body</CardTitle>
							</CardHeader>
							<CardContent>
								<SchemaViewer schema={doc.requestBodySchema} />
							</CardContent>
						</Card>

						<Separator class="my-4" />
					{/if}

					<!-- Responses -->
					{#if Object.keys(doc.responseSchemas || {}).length}
						<Card>
							<CardHeader>
								<CardTitle>Responses</CardTitle>
							</CardHeader>
							<CardContent>
								<Tabs.Root value={Object.keys(doc.responseSchemas)[0]}>
									<Tabs.List>
										{#each Object.keys(doc.responseSchemas) as status}
											<Tabs.Trigger value={status}>{status}</Tabs.Trigger>
										{/each}
									</Tabs.List>

									{#each Object.entries(doc.responseSchemas) as [status, schema]}
										<Tabs.Content value={status} class="mt-2">
											<SchemaViewer {schema} />
										</Tabs.Content>
									{/each}
								</Tabs.Root>
							</CardContent>
						</Card>
					{/if}
				{/if}
			{/await}

			<Separator class="my-6" />
		</div>
	{/each}
{/if}
