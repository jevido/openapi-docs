<script>
	import { page } from '$app/state';
	import { getEndpointDoc, specs } from '$lib/api/openapi.js';

	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import SchemaViewer from '$lib/components/schema-viewer.svelte';

	// route params
	const method = $derived(page.params.method?.toUpperCase());
	const encodedPath = $derived(page.params.path);

	const realPath = $derived.by(() => {
		if (!encodedPath) return '';
		return '/' + encodedPath.replace(/_/g, '/');
	});

	const doc = $derived.by(() => {
		if (!specs || !method || !realPath) return null;
		return getEndpointDoc(specs, realPath, method);
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

{#if !doc}
	<div class="text-muted-foreground">Endpoint not found.</div>
{:else}
	<!-- Header -->
	<div class="flex flex-col gap-3">
		<div class="flex items-center gap-3">
			<Badge variant="outline" class={methodClass(doc.method)}>
				{doc.method}
			</Badge>
			<h1 class="text-2xl font-semibold tracking-tight">{doc.path}</h1>
		</div>

		{#if doc.summary}
			<p class="text-muted-foreground">{doc.summary}</p>
		{/if}

		{#if doc.description}
			<p class="text-sm text-muted-foreground">{doc.description}</p>
		{/if}
	</div>

	<Separator class="my-6" />

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

		<Separator class="my-6" />
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

		<Separator class="my-6" />
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
							<Tabs.Trigger value={status}>
								{status}
							</Tabs.Trigger>
						{/each}
					</Tabs.List>

					{#each Object.entries(doc.responseSchemas) as [status, schema]}
						<Tabs.Content value={status} class="mt-4">
							<SchemaViewer {schema} />
						</Tabs.Content>
					{/each}
				</Tabs.Root>
			</CardContent>
		</Card>
	{/if}
{/if}
