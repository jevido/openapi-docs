<script>
	import { page } from '$app/state';
	import { onNavigate } from '$app/navigation';
	import {
		createOpenApiLinkResolver,
		endpointAnchor,
		getEndpointsByTag,
		getEndpointDoc,
		getServerUrl,
		getTag,
		schemaToExample
	} from '$lib/api/openapi.js';
	import { activeOpenApiSource, openapiSpecs } from '$lib/stores/openapi.js';

	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import EndpointClientDialog from '$lib/components/endpoint-client-dialog.svelte';
	import Markdown from '$lib/components/markdown.svelte';
	import SchemaViewerMobile from '$lib/components/schema-viewer-mobile.svelte';
	import Editor from '$lib/components/editor.svelte';

	// todo: add a shortcut for opening the open api client for the response

	onNavigate(({ to }) => {
		if (to?.hash) {
			// Scroll to the hash target after navigation completes
			requestAnimationFrame(() => {
				const element = document.getElementById(to.hash.slice(1));
				if (element) {
					element.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			});
		}
	});

	const currentTag = $derived(page.params.tag);
	const specUrl = $derived.by(() => $activeOpenApiSource?.url ?? '');
	const tagInfo = $derived.by(() => {
		if (!$openapiSpecs || !currentTag) return null;
		return getTag($openapiSpecs, currentTag);
	});

	const endpoints = $derived.by(() => {
		if (!$openapiSpecs || !currentTag) return [];
		return getEndpointsByTag($openapiSpecs)[currentTag] ?? [];
	});
	const linkResolver = $derived.by(() => createOpenApiLinkResolver($openapiSpecs));

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
		return getServerUrl($openapiSpecs, endpoint.path, endpoint.method) || page.url.origin;
	}

	function formatSchemaType(schema) {
		if (!schema) return '—';
		const base = schema.type || 'object';
		return schema.format ? `${base} (${schema.format})` : base;
	}

	function formatExampleValue(value) {
		if (value == null) return '—';
		if (typeof value === 'string') return value;
		return JSON.stringify(value, null, 2);
	}

	function formatExamplesPreview(examples) {
		if (!examples?.length) return '—';
		const example = examples[0];
		if (example?.externalValue) return example.externalValue;
		return formatExampleValue(example?.value);
	}

	function isValidIdentifier(value) {
		return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
	}

	function sdkAccessorForPath(path) {
		if (!path) return 'sdk';
		const parts = path.split('/').filter(Boolean);
		let result = 'sdk';
		parts.forEach((part) => {
			const match = part.match(/^{(.+)}$/);
			if (match) {
				const param = match[1];
				if (isValidIdentifier(param)) {
					result += `[${param}]`;
				} else {
					result += `['${param}']`;
				}
				return;
			}
			if (isValidIdentifier(part)) {
				result += `.${part}`;
			} else {
				result += `['${part}']`;
			}
		});
		return result;
	}

	function formatSdkBody(value) {
		const trimmed = value.trim();
		if (!trimmed) return '{}';
		const lines = trimmed.split('\n');
		if (lines.length === 1) return trimmed;
		return `\n${lines.map((line) => `  ${line}`).join('\n')}\n`;
	}

	function getRequestExample(doc) {
		const schema = doc?.requestBodySchema;
		if (!schema) return '';
		const example = schemaToExample(schema);
		return JSON.stringify(example ?? {}, null, 2);
	}

	function buildSdkSnippet(endpoint, baseUrl, requestExample, doc) {
		const method = endpoint.method.toLowerCase();
		const sdkAccess = `${sdkAccessorForPath(endpoint.path)}.${method}`;
		const options = [];
		if (baseUrl) options.push(`baseUrl: "${baseUrl}"`);
		const optionsBlock = options.length ? `, {\n  ${options.join(',\n  ')}\n}` : '';
		const supportsBody = !['GET', 'HEAD'].includes(endpoint.method);
		const bodyValue = formatSdkBody(requestExample || '{}');

		let callLine = '';
		if (supportsBody) {
			callLine = `${sdkAccess}(${bodyValue})`;
		} else {
			// For GET/HEAD requests, include query parameters
			const queryParams =
				doc?.parameters
					?.filter((param) => param.in === 'query')
					?.map((param) => ({
						name: param.name,
						schema: param.schema
					})) || [];

			if (queryParams.length > 0) {
				const paramLines = queryParams
					.map((param) => {
						const schemaType = param.schema?.type;
						let exampleValue = '';
						if (schemaType === 'integer') exampleValue = '64';
						else if (schemaType === 'number') exampleValue = '64';
						else if (param.schema?.enum?.length) exampleValue = `"${param.schema.enum[0]}"`;
						else exampleValue = '""';
						return `  ${param.name}: ${exampleValue}`;
					})
					.join(',\n');
				callLine = `${sdkAccess}({\n${paramLines}\n})`;
			} else {
				callLine = `${sdkAccess}()`;
			}
		}

		return [
			'import { createSDK } from "jevido-sdk";',
			'',
			`const sdk = await createSDK("${specUrl}"${optionsBlock});`,
			'',
			`const result = await ${callLine};`
		].join('\n');
	}

	function getResponseExample(doc, status) {
		const schema = doc?.responseSchemas?.[status];
		if (!schema) return '';
		const example = schemaToExample(schema);
		return JSON.stringify(example ?? {}, null, 2);
	}
</script>

<svelte:head>
	<title>{currentTag ? `${currentTag} API` : 'API'}</title>
</svelte:head>

{#if !endpoints?.length}
	<div class="text-muted-foreground">No endpoints found for tag "{currentTag}".</div>
{:else}
	{#if tagInfo?.description}
		<Card class="border border-muted/20 bg-muted/5">
			<CardHeader>
				<CardTitle>{tagInfo.name}</CardTitle>
			</CardHeader>
			<CardContent>
				<Markdown content={tagInfo.description} {linkResolver} />
			</CardContent>
		</Card>
	{/if}
	{#each endpoints as endpoint (endpoint.path + endpoint.method)}
		{#await Promise.resolve(getEndpointDoc($openapiSpecs, endpoint.path, endpoint.method)) then doc}
			{@const requestExample = getRequestExample(doc)}
			{@const sdkSnippet = buildSdkSnippet(
				endpoint,
				endpointBaseUrl(endpoint),
				requestExample,
				doc
			)}
			<div id={endpointAnchor(endpoint.path, endpoint.method)} class="scroll-mt-20 space-y-6">
				<Card class="border border-border bg-background/50 shadow-sm">
					<CardHeader class="space-y-3">
						<div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
							<Badge variant="outline" class={methodClass(endpoint.method)}>
								{endpoint.method}
							</Badge>
							<h2 class="text-lg font-semibold break-all">{endpoint.path}</h2>
							{#if doc?.deprecated}
								<Badge variant="outline" class="text-rose-500">Deprecated</Badge>
							{/if}
							{#if doc?.extensions?.['x-scalar-stability']}
								<Badge variant="outline" class="text-amber-500">
									{doc.extensions['x-scalar-stability']}
								</Badge>
							{/if}
						</div>
						<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							{#if endpoint.summary}
								<p class="text-sm text-muted-foreground">{endpoint.summary}</p>
							{/if}
							<EndpointClientDialog
								{endpoint}
								{doc}
								baseUrl={endpointBaseUrl(endpoint)}
								{specUrl}
							/>
						</div>
					</CardHeader>

					<CardContent class="space-y-6">
						{#if doc?.description}
							<Markdown content={doc.description} {linkResolver} />
						{/if}

						<div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
							<div class="space-y-4">
								{#if doc?.operationId || doc?.externalDocs || Object.keys(doc?.extensions || {}).length}
									<details class="rounded-lg border border-muted/20 bg-muted/5 p-4">
										<summary class="cursor-pointer text-sm font-medium">Details</summary>
										<div class="mt-3 space-y-2">
											{#if doc.operationId}
												<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
													<div class="font-medium">Operation ID</div>
													<div class="font-mono text-sm break-all">{doc.operationId}</div>
												</div>
											{/if}
											{#if doc.deprecated}
												<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
													<div class="font-medium">Deprecated</div>
													<div>Yes</div>
												</div>
											{/if}
											{#if doc.externalDocs}
												<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
													<div class="font-medium">External Docs</div>
													<div class="break-all">
														<a
															class="text-primary underline-offset-4 hover:underline"
															href={doc.externalDocs.url}
															rel="noreferrer"
															target="_blank"
														>
															{doc.externalDocs.description || doc.externalDocs.url}
														</a>
													</div>
												</div>
											{/if}
											{#if Object.keys(doc.extensions || {}).length}
												{#each Object.entries(doc.extensions) as [key, value] (key)}
													<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
														<div class="font-medium">{key}</div>
														<div class="font-mono text-xs break-all">
															{formatExampleValue(value)}
														</div>
													</div>
												{/each}
											{/if}
										</div>
									</details>
								{/if}

								{#if doc?.servers?.length}
									<details class="rounded-lg border border-muted/20 bg-muted/5 p-4">
										<summary class="cursor-pointer text-sm font-medium">Servers</summary>
										<div class="mt-3 space-y-3">
											{#each doc.servers as server (server.url)}
												<div class="space-y-1 rounded-md border border-border bg-muted/10 p-2">
													<div class="text-xs font-medium">URL</div>
													<div class="font-mono text-xs break-all">
														{server.resolvedUrl || server.url}
													</div>
													{#if server.description}
														<div class="mt-2 text-xs text-muted-foreground">
															{server.description}
														</div>
													{/if}
												</div>
											{/each}
										</div>
									</details>
								{/if}

								{#if doc?.securityRequirements?.length}
									<details class="rounded-lg border border-muted/20 bg-muted/5 p-4">
										<summary class="cursor-pointer text-sm font-medium">Security</summary>
										<div class="mt-3 space-y-3">
											{#each doc.securityRequirements as requirement, index (index)}
												<div class="space-y-3 rounded-md border border-border bg-muted/10 p-3">
													<div class="text-xs tracking-[0.2em] text-muted-foreground uppercase">
														Requirement {index + 1}
													</div>
													{#if !requirement.schemes?.length}
														<p class="text-xs text-muted-foreground">No authentication required.</p>
													{:else}
														{#each requirement.schemes as scheme (scheme.name)}
															<div class="space-y-1">
																<div class="flex flex-wrap items-center gap-2">
																	<Badge variant="outline">{scheme.name}</Badge>
																	{#if scheme.scheme?.type}
																		<span class="text-xs text-muted-foreground">
																			{scheme.scheme.type}
																		</span>
																	{/if}
																</div>
																{#if scheme.scheme?.description}
																	<p class="text-xs text-muted-foreground">
																		{scheme.scheme.description}
																	</p>
																{/if}
																{#if scheme.scopes?.length}
																	<div class="flex flex-wrap gap-2">
																		{#each scheme.scopes as scope}
																			<Badge variant="outline">{scope}</Badge>
																		{/each}
																	</div>
																{/if}
															</div>
														{/each}
													{/if}
												</div>
											{/each}
										</div>
									</details>
								{/if}

								{#if doc?.parameters?.length}
									<details class="rounded-lg border border-muted/20 bg-muted/5 p-4" open>
										<summary class="cursor-pointer text-sm font-medium">Parameters</summary>
										<div class="mt-3 space-y-3">
											{#each doc.parameters as param (param.name + param.in)}
												{@const preview = formatExamplesPreview(param.examples)}
												<div class="space-y-2 rounded-md border border-border bg-muted/10 p-3">
													<div class="flex flex-wrap items-start justify-between gap-2">
														<div class="font-mono text-sm">{param.name}</div>
														<div class="flex flex-wrap gap-2">
															<Badge variant="outline">{param.in}</Badge>
															{#if param.required}
																<Badge variant="outline" class="text-rose-400">Required</Badge>
															{/if}
														</div>
													</div>
													<div class="text-xs text-muted-foreground">
														Type: {formatSchemaType(param.schema)}
													</div>
													{#if param.description}
														<div class="text-sm text-muted-foreground">{param.description}</div>
													{/if}
													{#if preview !== '—'}
														<div class="rounded bg-background/50 p-2">
															<div class="mb-1 text-xs font-medium text-muted-foreground">
																Example:
															</div>
															<div class="font-mono text-xs break-all">{preview}</div>
														</div>
													{/if}
												</div>
											{/each}
										</div>
									</details>
								{/if}

								{#if doc?.requestBody}
									<details class="rounded-lg border border-muted/20 bg-muted/5 p-4" open>
										<summary class="cursor-pointer text-sm font-medium">Request Body</summary>
										<div class="mt-3 space-y-3">
											{#if doc.requestBody.description}
												<p class="text-sm text-muted-foreground">{doc.requestBody.description}</p>
											{/if}
											{#if doc.requestBody.required}
												<Badge variant="outline">Required</Badge>
											{/if}
											{#if doc.requestBody.content?.length}
												<Tabs.Root value={doc.requestBody.content[0].mediaType}>
													<Tabs.List class="mb-2">
														{#each doc.requestBody.content as content (content.mediaType)}
															<Tabs.Trigger value={content.mediaType}>
																{content.mediaType}
															</Tabs.Trigger>
														{/each}
													</Tabs.List>
													{#each doc.requestBody.content as content (content.mediaType)}
														<Tabs.Content value={content.mediaType} class="space-y-3">
															{#if content.schema}
																<SchemaViewerMobile schema={content.schema} />
															{:else}
																<div class="text-sm text-muted-foreground">No schema</div>
															{/if}

															{#if content.examples?.length}
																<div class="space-y-2">
																	<div
																		class="text-xs tracking-[0.2em] text-muted-foreground uppercase"
																	>
																		Examples
																	</div>
																	{#if content.examples.length === 1}
																		{#if content.examples[0].externalValue}
																			<a
																				class="text-xs text-primary underline-offset-4 hover:underline"
																				href={content.examples[0].externalValue}
																				rel="noreferrer"
																				target="_blank"
																			>
																				{content.examples[0].externalValue}
																			</a>
																		{:else}
																			<pre
																				class="rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
{formatExampleValue(content.examples[0].value)}
																			</pre>
																		{/if}
																	{:else}
																		<Tabs.Root value={content.examples[0].name || 'Example 1'}>
																			<Tabs.List class="mb-2">
																				{#each content.examples as example, exampleIndex (example.name || exampleIndex)}
																					<Tabs.Trigger
																						value={example.name || `Example ${exampleIndex + 1}`}
																					>
																						{example.name || `Example ${exampleIndex + 1}`}
																					</Tabs.Trigger>
																				{/each}
																			</Tabs.List>
																			{#each content.examples as example, exampleIndex (example.name || exampleIndex)}
																				<Tabs.Content
																					value={example.name || `Example ${exampleIndex + 1}`}
																					class="space-y-2"
																				>
																					{#if example.summary}
																						<div class="text-xs text-muted-foreground">
																							{example.summary}
																						</div>
																					{/if}
																					{#if example.description}
																						<div class="text-xs text-muted-foreground">
																							{example.description}
																						</div>
																					{/if}
																					{#if example.externalValue}
																						<a
																							class="text-xs text-primary underline-offset-4 hover:underline"
																							href={example.externalValue}
																							rel="noreferrer"
																							target="_blank"
																						>
																							{example.externalValue}
																						</a>
																					{:else}
																						<pre
																							class="rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
{formatExampleValue(example.value)}
																						</pre>
																					{/if}
																				</Tabs.Content>
																			{/each}
																		</Tabs.Root>
																	{/if}
																</div>
															{/if}
														</Tabs.Content>
													{/each}
												</Tabs.Root>
											{:else}
												<div class="text-sm text-muted-foreground">
													No request body content defined.
												</div>
											{/if}
										</div>
									</details>
								{/if}
							</div>

							<div class="space-y-4 lg:sticky lg:top-6 lg:self-start">
								<details
									open
									class="overflow-hidden rounded-xl border border-border bg-card/70 text-card-foreground"
								>
									<summary
										class="flex cursor-pointer items-center justify-between gap-2 border-b border-border px-4 py-3"
									>
										<div class="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
											<Badge variant="outline" class={methodClass(endpoint.method)}>
												{endpoint.method}
											</Badge>
											<span class="truncate font-mono">{endpoint.path}</span>
										</div>
										<span
											class="text-xs tracking-[0.2em] whitespace-nowrap text-muted-foreground uppercase"
										>
											Request
										</span>
									</summary>
									<div class="overflow-hidden p-4">
										<Editor value={sdkSnippet} language="javascript" disabled={true} />
									</div>
								</details>

								<details
									open
									class="overflow-hidden rounded-xl border border-border bg-card/70 text-card-foreground"
								>
									<summary
										class="flex cursor-pointer items-center justify-between border-b border-border px-4 py-3"
									>
										<span class="text-xs tracking-[0.2em] text-muted-foreground uppercase">
											Response
										</span>
									</summary>
									{#if doc && Object.keys(doc.responses || {}).length}
										<div class="overflow-hidden p-4">
											<Tabs.Root value={Object.keys(doc.responses)[0]}>
												<Tabs.List class="mb-3 flex flex-wrap gap-2">
													{#each Object.keys(doc.responses) as status (status)}
														<Tabs.Trigger value={status}>{status}</Tabs.Trigger>
													{/each}
												</Tabs.List>

												{#each Object.keys(doc.responses) as status (status)}
													{@const responseExample = getResponseExample(doc, status)}
													<Tabs.Content value={status} class="overflow-hidden">
														{#if responseExample}
															<Editor value={responseExample} language="json" disabled={true} />
														{:else}
															<div class="text-sm text-muted-foreground">No example available.</div>
														{/if}
													</Tabs.Content>
												{/each}
											</Tabs.Root>
										</div>
									{:else}
										<div class="p-4 text-sm text-muted-foreground">No responses defined.</div>
									{/if}
								</details>
							</div>
						</div>
					</CardContent>
				</Card>

				<Separator class="my-6" />
			</div>
		{/await}
	{/each}
{/if}
