<script>
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { getBaseUrl, getOperations, getSpecMeta } from '$lib/api/openapi.js';

	let { data } = $props();

	const spec = $derived(data?.spec ?? null);
	const specUrl = $derived(data?.specUrl ?? null);
	const errorMessage = $derived(data?.error ?? null);

	const meta = $derived(spec ? getSpecMeta(spec) : null);
	const baseUrl = $derived(spec ? getBaseUrl(spec, specUrl) : '');
	const operations = $derived(spec ? getOperations(spec) : []);
	const sdkSnippet = $derived.by(() => buildSdkSnippet(specUrl, operations[0]));

	function getContentTypes(requestBody) {
		if (!requestBody?.content) return [];
		return Object.keys(requestBody.content);
	}

	function buildSdkSnippet(openapiUrl, operation) {
		if (!operation) return '';
		const openapiLocation = openapiUrl || 'https://api.example.com/openapi.json';
		const pathParams = operation.path.match(/\{[^}]+\}/g) ?? [];
		const queryParams = operation.parameters.filter((param) => param.in === 'query');
		const hasBody = Boolean(operation.requestBody);
		const hasJson = getContentTypes(operation.requestBody).includes('application/json');

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

		const sdkPath = buildSdkPath(operation.path);
		const callArgs = hasBody ? 'body' : '';

		return `import { createSDK } from "jevido-sdk";

${queryNote}const sdk = await createSDK("${openapiLocation}");

${pathVars}${pathVars && bodySnippet ? '\n' : ''}${bodySnippet}const data = await ${sdkPath}.${operation.method}(${callArgs});
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
</script>

<svelte:head>
	<title>{meta?.title ?? 'Client'}</title>
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
			<Card.Header>
				<Card.Title class="text-base">SDK usage</Card.Title>
				<Card.Description>
					A tiny example request using the first endpoint in your spec.
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="flex flex-wrap gap-2 text-sm">
					<Badge variant="outline">Base URL: {baseUrl || 'not set'}</Badge>
					<Badge variant="outline">{operations.length} operations</Badge>
				</div>

				{#if sdkSnippet}
					<pre class="rounded-md border border-border/60 bg-muted/60 p-4 font-mono text-xs text-foreground">
{sdkSnippet}
					</pre>
				{:else}
					<p class="text-sm text-muted-foreground">
						Add a valid OpenAPI spec to preview an SDK example.
					</p>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}
</div>
