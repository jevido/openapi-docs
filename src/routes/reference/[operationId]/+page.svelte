<script>
	import { page } from '$app/state';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { getBaseUrl, getOperations, getSpecMeta } from '$lib/api/openapi.js';
	import { createSDK } from 'jevido-sdk';

	let { data } = $props();

	let spec = $derived(data?.spec ?? null);
	let specUrl = $derived(data?.specUrl ?? null);
	let errorMessage = $derived(data?.error ?? null);

	let meta = $derived(spec ? getSpecMeta(spec) : null);
	let baseUrl = $derived(spec ? getBaseUrl(spec, specUrl) : '');
	let operations = $derived(spec ? getOperations(spec) : []);
	let clientCount = $derived(operations.length);

	let operationParam = $derived(page.params?.operationId ?? '');
	let operationId = $derived.by(() => {
		if (!operationParam) return '';
		try {
			return decodeURIComponent(operationParam);
		} catch {
			return operationParam;
		}
	});

	let operation = $derived.by(() => {
		if (!operationId) return null;
		return operations.find((op) => op.operationId === operationId) ?? null;
	});

	let sdkSnippet = $derived.by(() => buildSdkSnippet(specUrl, operation));
	let requestUrl = $state('');
	let requestBody = $state('');
	let responseStatus = $state('');
	let responseBody = $state('');
	let isSubmitting = $state(false);
	let sdk = $state(null);
	let sdkError = $state('');
	let sdkLoading = $state(false);

	let hasJsonBody = $derived.by(() => {
		return Boolean(operation && getContentTypes(operation.requestBody).includes('application/json'));
	});

	let suggestedUrl = $derived.by(() => {
		if (!baseUrl || !operation) return '';
		return `${baseUrl}${operation.path}`;
	});

	$effect(() => {
		if (!requestUrl && suggestedUrl) requestUrl = suggestedUrl;
		if (hasJsonBody && !requestBody) requestBody = '{\n  \n}';
	});

	$effect(() => {
		if (!specUrl) {
			sdk = null;
			sdkError = '';
			sdkLoading = false;
			return;
		}

		let active = true;
		sdkLoading = true;
		sdkError = '';

		void (async () => {
			try {
				const instance = await createSDK(specUrl, baseUrl ? { baseUrl } : undefined);
				if (!active) return;
				sdk = instance;
			} catch (err) {
				if (!active) return;
				sdk = null;
				sdkError = err instanceof Error ? err.message : String(err);
			} finally {
				if (active) sdkLoading = false;
			}
		})();

		return () => {
			active = false;
		};
	});

	function getContentTypes(requestBody) {
		if (!requestBody?.content) return [];
		return Object.keys(requestBody.content);
	}

	function getResponseEntries(responses) {
		return Object.entries(responses ?? {}).map(([status, response]) => ({
			status,
			description: response?.description ?? ''
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

	function buildSdkSnippet(openapiUrl, op) {
		if (!op) return '';
		const openapiLocation = openapiUrl || 'https://api.example.com/openapi.json';
		const pathParams = op.path.match(/\{[^}]+\}/g) ?? [];
		const queryParams = op.parameters.filter((param) => param.in === 'query');
		const hasBody = Boolean(op.requestBody);
		const hasJson = getContentTypes(op.requestBody).includes('application/json');

		const pathVars = pathParams
			.map((param) => toIdentifier(param.replace(/[{}]/g, '')))
			.map((param) => `const ${param} = '...';`)
			.join('\n');
		const bodySnippet = hasBody
			? hasJson
				? `const body = { /* ... */ };\n`
				: `const body = /* ... */;\n`
			: '';
		const queryNote =
			queryParams.length > 0
				? `// Query params are not supported by the SDK yet.\n`
				: '';

		const sdkPath = buildSdkPath(op.path);
		const callArgs = hasBody ? 'body' : '';

		return `import { createSDK } from "jevido-sdk";

${queryNote}const sdk = await createSDK("${openapiLocation}");

${pathVars}${pathVars && bodySnippet ? '\n' : ''}${bodySnippet}const data = await ${sdkPath}.${op.method}(${callArgs});
`;
	}

	function buildSdkPath(path) {
		const segments = path.split('/').filter(Boolean);
		return segments.reduce((acc, segment) => {
			if (segment.startsWith('{') && segment.endsWith('}')) {
				const paramName = toIdentifier(segment.slice(1, -1));
				return `${acc}[${paramName}]`;
			}

			if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment)) {
				return `${acc}.${segment}`;
			}

			return `${acc}['${segment}']`;
		}, 'sdk');
	}

	function toIdentifier(value) {
		const sanitized = value.replace(/[^A-Za-z0-9_$]/g, '_');
		if (/^[A-Za-z_$]/.test(sanitized)) return sanitized;
		return `param_${sanitized || 'value'}`;
	}

	function getPathSegmentsFromUrl(pathTemplate, urlValue, base) {
		if (!urlValue) return { segments: null, error: 'Request URL is required.' };
		let parsed;
		try {
			parsed = new URL(urlValue, base || window.location.origin);
		} catch {
			return { segments: null, error: 'Request URL is invalid.' };
		}

		const templateSegments = pathTemplate.split('/').filter(Boolean);
		const actualSegments = parsed.pathname.split('/').filter(Boolean);

		if (actualSegments.length !== templateSegments.length) {
			return {
				segments: null,
				error: 'Request URL does not match the endpoint path.'
			};
		}

		const segments = templateSegments.map((segment, index) => {
			if (segment.startsWith('{') && segment.endsWith('}')) {
				return actualSegments[index];
			}
			return segment;
		});

		return { segments, search: parsed.search };
	}

	async function runRequest() {
		if (!operation || !requestUrl) return;

		isSubmitting = true;
		responseStatus = '';
		responseBody = '';

		try {
			if (!sdk) {
				responseStatus = 'SDK not ready';
				responseBody = sdkLoading ? 'SDK is still initializing.' : sdkError || 'SDK is unavailable.';
				return;
			}

			const { segments, search, error } = getPathSegmentsFromUrl(
				operation.path,
				requestUrl,
				baseUrl
			);

			if (error) {
				responseStatus = 'Request failed';
				responseBody = error;
				return;
			}

			if (search) {
				responseStatus = 'Request failed';
				responseBody = 'Query params are not supported by the SDK yet.';
				return;
			}

			let bodyValue = undefined;
			if (hasJsonBody && requestBody) {
				bodyValue = JSON.parse(requestBody);
			}

			let caller = sdk;
			for (const segment of segments ?? []) {
				caller = caller[segment];
			}

			const method = operation.method;
			const result =
				['post', 'put', 'patch'].includes(method) && bodyValue !== undefined
					? await caller[method](bodyValue)
					: await caller[method]();

			if (
				result &&
				typeof result === 'object' &&
				'status' in result &&
				'error' in result
			) {
				responseStatus = `${result.status} Error`;
				responseBody = JSON.stringify(result.error, null, 2);
			} else {
				responseStatus = 'Success';
				responseBody = JSON.stringify(result, null, 2);
			}
		} catch (err) {
			responseStatus = 'Request failed';
			responseBody = err instanceof Error ? err.message : String(err);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>{operation?.summary ?? meta?.title ?? 'API Reference'}</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-6xl flex-col gap-6">
	{#if errorMessage}
		<Card.Root class="border-destructive/40">
			<Card.Header>
				<Card.Title>Unable to load the API spec</Card.Title>
				<Card.Description>{errorMessage}</Card.Description>
			</Card.Header>
		</Card.Root>
	{:else if !operation}
		<Card.Root>
			<Card.Header>
				<Card.Title>Endpoint not found</Card.Title>
				<Card.Description>
					This operation id does not exist in the current OpenAPI spec.
				</Card.Description>
			</Card.Header>
		</Card.Root>
	{:else}
		<div class="grid gap-6 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
			<Card.Root class="border-border/70 bg-card/70 backdrop-blur">
				<Card.Header class="flex flex-col gap-2">
					<div class="flex flex-wrap items-center gap-3">
						<Badge variant={methodVariant(operation.method)}>
							{operation.method.toUpperCase()}
						</Badge>
						<Card.Title class="text-xl">{operation.summary}</Card.Title>
					</div>
					<Card.Description class="font-mono text-sm">{operation.path}</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					{#if operation.description}
						<p class="text-sm text-muted-foreground">{operation.description}</p>
					{/if}

					{#if operation.parameters.length}
						<div class="space-y-2">
							<p class="text-xs font-medium uppercase text-muted-foreground">
								Parameters
							</p>
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>Name</Table.Head>
										<Table.Head>In</Table.Head>
										<Table.Head>Required</Table.Head>
										<Table.Head>Description</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each operation.parameters as parameter}
										<Table.Row>
											<Table.Cell class="font-mono text-xs">{parameter.name}</Table.Cell>
											<Table.Cell class="text-xs">{parameter.in}</Table.Cell>
											<Table.Cell class="text-xs">
												{parameter.required ? 'yes' : 'no'}
											</Table.Cell>
											<Table.Cell class="text-xs text-muted-foreground">
												{parameter.description ?? ''}
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						</div>
					{/if}

					{#if operation.requestBody}
						<div class="rounded-md border border-border/60 bg-muted/60 p-3">
							<div class="text-xs font-medium uppercase text-muted-foreground">
								Request body
							</div>
							<p class="text-sm">
								Content types: {getContentTypes(operation.requestBody).join(', ') || 'None'}
							</p>
						</div>
					{/if}

					{#if Object.keys(operation.responses ?? {}).length}
						<div class="space-y-2">
							<p class="text-xs font-medium uppercase text-muted-foreground">Responses</p>
							<Table.Root>
								<Table.Header>
									<Table.Row>
										<Table.Head>Status</Table.Head>
										<Table.Head>Description</Table.Head>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{#each getResponseEntries(operation.responses) as response}
										<Table.Row>
											<Table.Cell class="font-mono text-xs">{response.status}</Table.Cell>
											<Table.Cell class="text-xs text-muted-foreground">
												{response.description}
											</Table.Cell>
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<Card.Root class="sticky top-6 border-border/70 bg-card/70 backdrop-blur">
				<Card.Header class="space-y-1">
					<div class="flex items-center justify-between">
						<Card.Title class="text-base">Request example</Card.Title>
						<Badge variant="outline">bakery-sdk</Badge>
					</div>
					<Card.Description>Use bakery-sdk against the endpoint.</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<div class="flex flex-wrap gap-2 text-xs">
						<Badge variant="outline">Base URL: {baseUrl || 'not set'}</Badge>
						<Badge variant="outline">{clientCount} operations</Badge>
					</div>
					<Separator />
					{#if sdkSnippet}
						<pre class="rounded-md border border-border/60 bg-muted/60 p-4 font-mono text-xs text-foreground">
{sdkSnippet}
						</pre>
					{:else}
						<p class="text-sm text-muted-foreground">
							Add a valid OpenAPI spec to preview an SDK example.
						</p>
					{/if}
					<Separator />
					<div class="space-y-3">
						<div class="text-xs font-medium uppercase text-muted-foreground">
							Try it manually
						</div>
						<Input bind:value={requestUrl} placeholder="Request URL" />
						{#if hasJsonBody}
							<Textarea
								bind:value={requestBody}
								rows={6}
								placeholder={'{"example": "value"}'}
							/>
						{/if}
						<div class="flex items-center gap-2">
							<Button size="sm" disabled={isSubmitting} on:click={runRequest}>
								{isSubmitting ? 'Running...' : 'Run request'}
							</Button>
							{#if responseStatus}
								<span class="text-xs text-muted-foreground">{responseStatus}</span>
							{/if}
						</div>
						{#if responseBody}
							<pre class="max-h-60 overflow-auto rounded-md border border-border/60 bg-muted/60 p-3 font-mono text-xs text-foreground">
{responseBody}
							</pre>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	{/if}
</div>
