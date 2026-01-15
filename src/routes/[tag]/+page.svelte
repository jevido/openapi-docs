<script>
	import { page } from '$app/state';
	import { specs, getEndpointsByTag, getEndpointDoc, getServerUrl } from '$lib/api/openapi.js';

	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import EndpointClientDialog from '$lib/components/endpoint-client-dialog.svelte';
	import SchemaViewer from '$lib/components/schema-viewer.svelte';

	const currentTag = $derived(page.params.tag);

	const endpoints = $derived.by(() => {
		if (!specs || !currentTag) return [];
		return getEndpointsByTag(specs)[currentTag] ?? [];
	});

	function methodClass(method) {
		switch (method) {
			case 'GET':
				return 'bg-emerald-500/10 text-emerald-500';
			case 'POST':
				return 'bg-sky-500/10 text-sky-500';
			case 'PUT':
				return 'bg-indigo-500/10 text-indigo-500';
			case 'PATCH':
				return 'bg-amber-500/10 text-amber-500';
			case 'DELETE':
				return 'bg-rose-500/10 text-rose-500';
			default:
				return 'bg-muted text-muted-foreground';
		}
	}

	function endpointBaseUrl(endpoint) {
		return getServerUrl(specs, endpoint.path, endpoint.method) || page.url.origin;
	}
</script>

<svelte:head>
	<title>{currentTag ? `${currentTag} API` : 'API'}</title>
</svelte:head>

{#if !endpoints?.length}
	<div class="text-muted-foreground">No endpoints found for tag "{currentTag}".</div>
{:else}
	{#each endpoints as endpoint (endpoint.path + endpoint.method)}
		{#await Promise.resolve(getEndpointDoc(specs, endpoint.path, endpoint.method)) then doc}
			{$inspect(doc)}
			<div id={`${endpoint.path}-${endpoint.method}`} class="space-y-4">
				<!-- Endpoint Card -->
				<Card class="border border-border bg-background/50 shadow-sm">
					<CardHeader class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div class="flex items-center gap-3">
							<Badge variant="outline" class={methodClass(endpoint.method)}>
								{endpoint.method}
							</Badge>
							<h2 class="text-lg font-semibold">{endpoint.path}</h2>
						</div>
						<div class="flex flex-wrap items-center gap-3">
							{#if endpoint.summary}
								<p class="text-sm text-muted-foreground">{endpoint.summary}</p>
							{/if}
							<EndpointClientDialog {endpoint} {doc} baseUrl={endpointBaseUrl(endpoint)} />
						</div>
					</CardHeader>

					<CardContent class="space-y-4">
						<Separator class="my-0" />

						<!-- Parameters -->
						{#if doc?.parameters?.length}
							<Card class="border border-muted/20 bg-muted/5 p-3">
								<CardHeader>
									<CardTitle>Parameters</CardTitle>
								</CardHeader>
								<CardContent class="p-0">
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
											{#each doc.parameters as param (param.name + param.in)}
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
						{/if}

						<!-- Request Body -->
						{#if doc?.requestBodySchema}
							<Card class="border border-muted/20 bg-muted/5 p-3">
								<CardHeader>
									<CardTitle>Request Body</CardTitle>
								</CardHeader>
								<CardContent class="p-0">
									<SchemaViewer schema={doc.requestBodySchema} />
								</CardContent>
							</Card>
						{/if}

						<!-- Responses -->
						{#if doc && Object.keys(doc.responseSchemas || {}).length}
							<Card class="border border-muted/20 bg-muted/5 p-3">
								<CardHeader>
									<CardTitle>Responses</CardTitle>
								</CardHeader>
								<CardContent class="p-0">
									<Tabs.Root value={Object.keys(doc.responseSchemas)[0]}>
										<Tabs.List class="mb-2">
											{#each Object.keys(doc.responseSchemas) as status (status)}
												<Tabs.Trigger value={status}>{status}</Tabs.Trigger>
											{/each}
										</Tabs.List>

										{#each Object.entries(doc.responseSchemas) as [status, schema] (status)}
											<Tabs.Content value={status}>
												<SchemaViewer {schema} />
											</Tabs.Content>
										{/each}
									</Tabs.Root>
								</CardContent>
							</Card>
						{/if}
					</CardContent>
				</Card>

				<Separator class="my-4" />
			</div>
		{/await}
	{/each}
{/if}
