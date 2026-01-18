<script>
	import { page } from '$app/state';
	import Editor from './editor.svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import { schemaToExample } from '$lib/api/openapi.js';
	import { cn } from '$lib/utils';
	let { endpoint, doc, baseUrl, specUrl = '' } = $props();

	let open = $state(false);
	let bearerToken = $state('');
	let responseText = $state('');
	let responseStatus = $state('');
	let errorText = $state('');
	let loading = $state(false);
	let responseDurationMs = $state(null);
	let requestAccordion = $state(['query', 'body', 'snippet']);
	let mobileViewMode = $state('request'); // 'request' or 'response'

	// todo: remove manual fetch use jevido-sdk instead
	// todo: fix the data leak, 1600 requests aint normal with 136mb download
	// todo: add a before request, and after response script option (these scripts should add a editor with javascript, and users should not HAVE to write fetch themselves they can, but jevido-sdk is available to the script), there should be a global variable for them (mind you this is endpoint & openapi bound, not just 1 of the 2), and the response script should have a const called "response" which contains the response value (not just body, but the body is parsed as json)
	// todo: implement a way to share the requests/response scripts
	// todo: make the component responsive for smaller screens
	// todo: stylize the component so it has a more modern look
	// todo: the url related query params should be locked as they are required for the url to be build. So your should not be able to remove the query parameters such as :guildId, but you can remove url search parameters such as ?limit=x
	// todo: write the correct snippet for bakery-sdk, the createSDK accepts 1 param, a string to this openapi.json specs like so: const sdk = await createSDK("https://api.example.com/openapi.json");
	// todo: allow injecting variables to the request body, such as {token} or {user.id}

	function methodBadgeClass(method) {
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

	function joinUrl(base, path) {
		if (!base) return path;
		if (base.endsWith('/') && path.startsWith('/')) return `${base.slice(0, -1)}${path}`;
		if (!base.endsWith('/') && !path.startsWith('/')) return `${base}/${path}`;
		return `${base}${path}`;
	}

	function resolveSpecBase() {
		if (!specUrl) return page.url.origin;
		try {
			return new URL(specUrl, page.url.origin).toString();
		} catch {
			return page.url.origin;
		}
	}

	function toAbsoluteUrl(value) {
		try {
			const base = resolveSpecBase();
			return new URL(value, base).toString();
		} catch {
			return value;
		}
	}

	let rowId = 0;
	let headerRows = $state([
		{ id: ++rowId, key: 'Accept', value: 'application/json', enabled: true },
		{ id: ++rowId, key: '', value: '', enabled: true }
	]);
	let queryRows = $state([]);

	let requestUrl = $derived.by(() => joinUrl(baseUrl, endpoint.path));
	let pathParamKeys = $derived.by(() => {
		const pathParams = endpoint.path.match(/{[^}]+}/g) ?? [];
		return pathParams
			.map((param) => param.slice(1, -1).trim())
			.filter((key, index, list) => key && list.indexOf(key) === index);
	});
	let requestUrlWithParams = $derived(buildUrlWithParams(requestUrl, queryRows, pathParamKeys));

	function addHeaderRow() {
		headerRows.push({ id: ++rowId, key: '', value: '', enabled: true });
	}

	function addQueryRow() {
		queryRows.push({ id: ++rowId, key: '', value: '', enabled: true });
	}

	function createInitialQueryRows() {
		const entries = [];
		const seen = [];
		const pathParams = endpoint.path.match(/{[^}]+}/g) ?? [];
		pathParams.forEach((param) => {
			const key = param.slice(1, -1).trim();
			if (!key || seen.includes(key)) return;
			seen.push(key);
			entries.push({ id: ++rowId, key, value: '', enabled: true });
		});
		doc?.parameters
			?.filter((param) => param.in === 'query')
			.forEach((param) => {
				const key = param.name?.trim();
				if (!key || seen.includes(key)) return;
				seen.push(key);
				entries.push({ id: ++rowId, key, value: '', enabled: true });
			});
		return entries;
	}

	function removeRow(list, id) {
		// Check if this is a path parameter (from pathParamKeys) - prevent deletion
		const row = list.find((r) => r.id === id);
		if (row && pathParamKeys.includes(row.key.trim())) {
			// Path parameters cannot be removed
			return;
		}

		const index = list.findIndex((row) => row.id === id);
		if (index !== -1) {
			list.splice(index, 1);
		}
	}

	function isPathParameter(key) {
		return pathParamKeys.includes(key.trim());
	}

	function buildUrlWithParams(rawUrl, params, pathParams = []) {
		if (!rawUrl) return '';
		try {
			const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawUrl);
			const base = hasProtocol ? undefined : 'http://placeholder';
			const pathParamSet = new Set(pathParams);
			const valueByKey = new Map();
			params.forEach((row) => {
				if (!row.enabled) return;
				const key = row.key.trim();
				if (!key) return;
				if (!pathParamSet.has(key)) return;
				if (!valueByKey.has(key)) {
					valueByKey.set(key, row.value ?? '');
				}
			});

			let resolvedUrl = rawUrl;
			pathParams.forEach((key) => {
				const value = valueByKey.get(key);
				if (value === undefined || value === '') return;
				resolvedUrl = resolvedUrl.replaceAll(`{${key}}`, value);
			});

			const url = new URL(resolvedUrl, base);
			params.forEach((row) => {
				if (!row.enabled) return;
				const key = row.key.trim();
				if (!key) return;
				if (pathParamSet.has(key)) return;
				url.searchParams.append(key, row.value ?? '');
			});
			const nextUrl = url.toString();
			return hasProtocol ? nextUrl : nextUrl.replace('http://placeholder', '');
		} catch {
			return rawUrl;
		}
	}

	function buildHeaders({ includeContentType } = {}) {
		const headers = {};
		let hasAccept = false;
		let hasContentType = false;
		let hasAuthorization = false;

		headerRows.forEach((row) => {
			if (!row.enabled) return;
			const key = row.key.trim();
			if (!key) return;
			headers[key] = row.value ?? '';
			const lower = key.toLowerCase();
			if (lower === 'accept') hasAccept = true;
			if (lower === 'content-type') hasContentType = true;
			if (lower === 'authorization') hasAuthorization = true;
		});

		if (!hasAccept) {
			headers.Accept = 'application/json';
		}

		if (includeContentType && bodyTextValue.trim() && !hasContentType) {
			headers['Content-Type'] = 'application/json';
		}

		const trimmedToken = bearerToken.trim();
		if (trimmedToken && !hasAuthorization) {
			headers.Authorization = `Bearer ${trimmedToken}`;
		}

		return headers;
	}

	let requestHeaders = $derived.by(() => buildHeaders({ includeContentType: true }));

	let bodyTextDraft = $state('');
	let bodyTextDirty = $state(false);
	let bodyJsonError = $state('');
	let bodyTextDefault = $derived.by(() => {
		if (!open) return '';
		const schema = doc?.requestBodySchema;
		if (!schema) return '';
		const example = schemaToExample(schema);
		return JSON.stringify(example ?? {}, null, 2);
	});
	let bodyTextValue = $derived.by(() => (bodyTextDirty ? bodyTextDraft : bodyTextDefault));

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

	let sdkSnippet = $derived.by(() => {
		const method = endpoint.method.toLowerCase();
		const sdkAccess = `${sdkAccessorForPath(endpoint.path)}.${method}`;
		const options = [];
		if (baseUrl) options.push(`baseUrl: "${baseUrl}"`);
		const trimmedToken = bearerToken.trim();
		if (trimmedToken) options.push(`token: "${trimmedToken}"`);
		const optionsBlock = options.length ? `, {\n  ${options.join(',\n  ')}\n}` : '';
		const supportsBody = !['GET', 'HEAD'].includes(endpoint.method);
		const bodyValue = formatSdkBody(bodyTextValue);

		// Collect query parameters
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
	});

	async function sendRequest() {
		loading = true;
		errorText = '';
		responseText = '';
		responseStatus = '';
		responseDurationMs = null;

		const start = performance.now();
		const url = requestUrlWithParams.trim() || requestUrl;
		const absoluteUrl = toAbsoluteUrl(url);

		const supportsBody = !['GET', 'HEAD'].includes(endpoint.method);
		let body;

		const headers = buildHeaders({ includeContentType: supportsBody });

		if (supportsBody && bodyTextValue.trim()) {
			body = bodyTextValue;
		}

		try {
			const res = await fetch(url, {
				method: endpoint.method,
				headers,
				body
			});

			responseStatus = `${res.status} ${res.statusText}`;
			const text = await res.text();

			try {
				responseText = JSON.stringify(JSON.parse(text), null, 2);
			} catch {
				responseText = text;
			}
			responseDurationMs = Math.round(performance.now() - start);
		} catch (error) {
			errorText = error?.message ?? 'Request failed.';
			responseDurationMs = Math.round(performance.now() - start);
		} finally {
			loading = false;
		}
	}

	function handleShortcut(event) {
		if (!open || loading) return;
		if (event.key === 'Enter' && event.ctrlKey) {
			event.preventDefault();
			sendRequest();
		}
	}
</script>

<svelte:window onkeydown={handleShortcut} />

{#snippet panelContent()}
	<div class="flex h-full min-h-0 flex-col">
		<div
			class="shrink-0 border-b border-border bg-muted/40 px-2 py-2 sm:px-3 sm:py-3 lg:px-6 lg:py-4"
		>
			<div class="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:flex-wrap lg:items-center">
				<InputGroup.Root class="w-full lg:max-w-3xl">
					<InputGroup.Addon>
						<Badge variant="outline" class={methodBadgeClass(endpoint.method)}>
							{endpoint.method}
						</Badge>
					</InputGroup.Addon>
					<InputGroup.Input
						class="text-xs text-foreground"
						value={decodeURIComponent(requestUrlWithParams) || requestUrl}
						placeholder={requestUrl}
						readonly
						onfocus={(event) => event.currentTarget?.select()}
					/>
				</InputGroup.Root>
				<Button
					size="sm"
					onclick={sendRequest}
					disabled={loading}
					class="w-full sm:w-auto lg:w-auto"
				>
					{loading ? 'Sending...' : 'Send'}
				</Button>
			</div>
		</div>

		<div
			class="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
		>
			<div
				class={cn(
					'flex min-h-0 flex-col border-b border-border lg:border-r lg:border-b-0',
					mobileViewMode === 'response' ? 'hidden lg:flex' : 'flex'
				)}
			>
				<div
					class="flex shrink-0 items-center justify-between border-b border-border px-2 py-2 text-xs tracking-[0.2em] text-muted-foreground uppercase sm:px-3 sm:py-3 lg:justify-start lg:px-6 lg:py-3"
				>
					Request Builder
					<Button
						size="icon-sm"
						variant="ghost"
						aria-label="View response"
						class="lg:hidden"
						onclick={() => (mobileViewMode = 'response')}
					>
						→
					</Button>
				</div>
				<div class="min-h-0 flex-1 overflow-y-auto">
					<!-- todo: find out why h-[1px] gives auto height, h-auto doesnt -->
					<div
						class="h-auto w-full space-y-2 px-2 py-2 text-xs text-muted-foreground sm:px-3 sm:py-3 lg:px-6 lg:py-4"
					>
						<Accordion.Root type="multiple" bind:value={requestAccordion} class="space-y-2">
							<Accordion.Item
								value="auth"
								class="rounded-md border border-border bg-muted/20 px-2 sm:px-3 lg:px-3"
							>
								<Accordion.Trigger
									class="py-2 text-xs tracking-[0.2em] text-muted-foreground uppercase sm:py-2 lg:py-3"
								>
									Authentication
								</Accordion.Trigger>
								<Accordion.Content class="pt-1">
									<InputGroup.Root>
										<InputGroup.Addon>
											<InputGroup.Text>Bearer</InputGroup.Text>
										</InputGroup.Addon>
										<InputGroup.Input
											class="text-xs"
											placeholder="Token"
											bind:value={bearerToken}
										/>
									</InputGroup.Root>
								</Accordion.Content>
							</Accordion.Item>

							<Accordion.Item
								value="query"
								class="rounded-md border border-border bg-muted/20 px-2 sm:px-3 lg:px-3"
							>
								<Accordion.Trigger
									class="py-2 text-xs tracking-[0.2em] text-muted-foreground uppercase sm:py-2 lg:py-3"
								>
									Query Parameters
								</Accordion.Trigger>
								<Accordion.Content class="pt-1">
									<div class="space-y-2">
										{#each queryRows as row (row.id)}
											<div
												class="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2"
											>
												<Checkbox bind:checked={row.enabled} disabled={isPathParameter(row.key)} />
												<InputGroup.Root class="h-8">
													<InputGroup.Input
														class="text-xs"
														placeholder="Key"
														bind:value={row.key}
														readonly={isPathParameter(row.key)}
													/>
												</InputGroup.Root>
												<InputGroup.Root class="h-8">
													<InputGroup.Input
														class="text-xs"
														placeholder="Value"
														bind:value={row.value}
													/>
												</InputGroup.Root>
												<Button
													size="icon-sm"
													variant="ghost"
													aria-label="Remove query param"
													disabled={isPathParameter(row.key)}
													onclick={() => removeRow(queryRows, row.id)}
												>
													x
												</Button>
											</div>
										{/each}
									</div>
									<Button size="sm" variant="ghost" onclick={addQueryRow}>Add query param</Button>
								</Accordion.Content>
							</Accordion.Item>

							<Accordion.Item
								value="headers"
								class="rounded-md border border-border bg-muted/20 px-2 sm:px-3 lg:px-3"
							>
								<Accordion.Trigger
									class="py-2 text-xs tracking-[0.2em] text-muted-foreground uppercase sm:py-2 lg:py-3"
								>
									Request Headers
								</Accordion.Trigger>
								<Accordion.Content class="pt-1">
									<div class="space-y-2">
										{#each headerRows as row (row.id)}
											<div
												class="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2"
											>
												<Checkbox bind:checked={row.enabled} />
												<InputGroup.Root class="h-8">
													<InputGroup.Input
														class="text-xs"
														placeholder="Header"
														bind:value={row.key}
													/>
												</InputGroup.Root>
												<InputGroup.Root class="h-8">
													<InputGroup.Input
														class="text-xs"
														placeholder="Value"
														bind:value={row.value}
													/>
												</InputGroup.Root>
												<Button
													size="icon-sm"
													variant="ghost"
													aria-label="Remove header"
													onclick={() => removeRow(headerRows, row.id)}
												>
													x
												</Button>
											</div>
										{/each}
									</div>
									<Button size="sm" variant="ghost" onclick={addHeaderRow}>Add header</Button>
								</Accordion.Content>
							</Accordion.Item>

							<Accordion.Item
								value="body"
								class="rounded-md border border-border bg-muted/20 px-2 sm:px-3 lg:px-3"
							>
								<Accordion.Trigger
									class="py-2 text-xs tracking-[0.2em] text-muted-foreground uppercase sm:py-2 lg:py-3"
								>
									Request Body
								</Accordion.Trigger>
								<Accordion.Content class="pt-1">
									<Editor language="json" bind:value={bodyTextValue} handleSubmit={sendRequest} />
								</Accordion.Content>
							</Accordion.Item>

							<Accordion.Item
								value="snippet"
								class="rounded-md border border-border bg-muted/20 px-2 sm:px-3 lg:px-3"
							>
								<Accordion.Trigger
									class="py-2 text-xs tracking-[0.2em] text-muted-foreground uppercase sm:py-2 lg:py-3"
								>
									Code Snippet
								</Accordion.Trigger>
								<Accordion.Content class="pt-1">
									<Editor language="javascript" disabled={true} value={sdkSnippet}></Editor>
								</Accordion.Content>
							</Accordion.Item>
						</Accordion.Root>
					</div>
				</div>
			</div>

			<div
				class={cn(
					'flex min-h-0 flex-col',
					mobileViewMode === 'request' ? 'hidden lg:flex' : 'flex'
				)}
			>
				<div
					class="flex shrink-0 items-center justify-between border-b border-border px-2 py-2 text-xs tracking-[0.2em] text-muted-foreground uppercase sm:px-3 sm:py-3 lg:justify-start lg:px-6 lg:py-3"
				>
					Response
					<Button
						size="icon-sm"
						variant="ghost"
						aria-label="Back to request"
						class="lg:hidden"
						onclick={() => (mobileViewMode = 'request')}
					>
						←
					</Button>
				</div>
				<div class="min-h-0 flex-1 overflow-y-auto">
					<div class="h-auto px-2 py-2 sm:px-3 sm:py-3 lg:px-6 lg:py-6">
						{#if errorText}
							<div
								class="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive"
							>
								{errorText}
							</div>
						{:else if responseText}
							<div class="space-y-3">
								<p class="text-xs tracking-[0.2em] text-muted-foreground uppercase">
									{responseStatus}
								</p>
								<pre
									class="rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
{responseText}
								</pre>
							</div>
						{:else}
							<div
								class="flex min-h-90 flex-col items-center justify-center gap-6 text-muted-foreground"
							>
								<pre class="text-xs leading-tight text-muted-foreground">
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⣤⣶⣲⣻⣿⢯⡿⣟⣿⣟⣶⣶⣤⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣤⢖⣿⡿⣷⢿⡻⣿⣽⡻⣽⡻⣽⣯⣿⣿⣿⣽⣿⣿⣿⣷⣦⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣠⣴⢺⡝⣲⣟⡞⣟⢧⣻⣝⢮⣽⣳⢽⣹⢷⣿⡞⣿⡿⣿⣽⣿⣿⣿⣿⣿⣿⣶⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⢔⣶⡝⡽⡜⣥⢧⣚⡱⣎⡳⣭⢶⣳⢮⢿⣜⣳⢯⣟⣮⢷⣻⣷⣻⢯⣿⣯⣿⣿⣿⣿⣿⣿⣿⣿⣦⡄⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣴⣯⢳⡌⡖⣩⢳⣛⣮⣦⣳⣽⣚⣵⣹⣎⣿⣯⣛⣯⣟⣻⣾⣹⣯⣷⣯⣿⣟⣿⣻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⡀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡴⣿⣿⠸⣬⢧⢧⡷⣯⢿⠻⣾⣿⢿⣿⡿⢿⣿⡿⣿⠿⡿⣿⣿⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣄⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣖⡟⡯⢖⢦⡳⣩⣞⡎⠷⡽⣭⢓⣮⢳⢧⣖⡽⣳⣭⢿⣫⢿⣟⣽⣷⣻⣿⣾⣯⡿⣽⣿⣻⣿⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣯⣻⠄⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣴⣿⣾⣫⣯⣝⡎⠶⣵⢇⡞⣽⣫⡷⣭⣻⡼⣹⣶⣫⢷⣳⡽⡷⣯⣽⣿⣿⣷⣏⣿⣿⣿⣽⣿⣿⣯⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡝⡞⡄
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⣿⠿⣟⣛⠛⠽⠽⠿⣫⣝⡾⣽⣾⣣⠟⣼⣣⢿⡞⣷⢯⣷⢿⣿⢿⡿⣽⡿⣿⣯⣿⣽⣷⣟⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣟⣼⠃
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣼⡝⠊⣼⣎⠍⠋⣠⠤⣌⢐⣬⠒⣊⢛⠻⣷⢾⣿⣻⣿⣻⣿⣿⣿⣿⣿⣻⣟⣿⣿⣿⢾⣽⣿⣾⣿⣟⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡽⣞⣧
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⣷⠊⠨⠁⡀⠈⠀⠘⡠⢕⠈⠀⡯⡄⠑⠠⡨⠝⣻⣿⣿⣿⣯⢯⣿⣿⣽⣿⢿⣻⡿⣿⣳⣿⣿⣿⣽⣿⣿⣿⣿⣿⣽⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢿⣻⢿⡉
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢟⣬⣢⠰⡎⢂⡰⠆⡈⡲⠗⡤⡃⠀⠀⠀⠀⠕⠦⣰⠙⢛⢿⣿⣿⣾⣿⣽⣿⣻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣟⣻⡞⠇⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢟⣎⠱⠀⠱⣀⡄⡈⠂⠀⠠⠆⠹⠀⡀⠀⣄⠀⠈⠃⢬⠛⢝⢻⣿⢿⣿⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣟⡞⣧⠟⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢻⡩⠀⢵⡁⠀⠀⠐⠁⠡⣊⢆⡀⠲⠢⠁⠠⠒⠈⠄⡠⠀⠇⢙⠷⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣯⣟⣞⡇⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⢯⢄⡳⡀⠀⠀⠀⠐⣁⠎⢈⠌⡖⠜⡨⢫⡀⠠⠀⠘⠀⠂⡀⠂⠘⣻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⣾⡽⠆⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢰⡯⢢⡈⡓⠀⢀⡢⠁⠐⡓⠂⡘⠈⠀⠀⠀⡄⠀⢀⠂⢴⠀⠅⠀⡈⢄⣘⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⣽⣳⢟⠇⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣿⠄⠢⠀⠢⠈⠀⠀⠀⠁⠈⠁⠀⠀⠒⠀⠁⡰⠆⣀⠈⠂⠀⠊⠀⠀⠀⢿⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣻⡷⣯⢿⠍⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣿⠓⢄⠈⢀⡀⠄⠀⠀⠤⠖⢈⠢⠀⠀⠑⡀⡀⠌⡁⠀⠀⢲⠀⠀⢈⠈⣤⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣟⣿⣳⣟⡻⠂⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢻⣻⣀⠀⢀⠀⠀⠶⡄⠀⠀⠀⠀⠀⠀⣠⡷⢀⡆⡄⢰⣼⠇⣀⢦⡇⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣿⠗⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣤⣤⣶⠶⣣⡍⣆⠈⡠⢄⡐⠀⠀⠀⠀⠀⠀⣀⠕⠁⠌⠁⢀⠈⠀⠀⣿⡼⢠⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣿⡾⡿⠋⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡠⣲⠿⠋⠉⠀⠀⠀⠙⡿⢿⣤⣄⠔⣘⠁⠄⠀⠀⠀⢁⠀⠈⡀⠀⠀⠀⠀⡠⡅⡀⢣⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⣿⢿⣟⣯⠝⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣶⣿⠛⠁⠀⠒⠉⠀⠀⠀⠀⠀⠈⠑⠻⠿⢶⣤⣨⠵⠄⠀⠀⠀⠂⠐⠐⣋⠠⠋⢪⠠⠥⣗⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠝⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⣲⡟⠙⠉⠀⢀⠤⠐⠈⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠑⠻⢶⠯⣴⡞⣠⣂⣤⠗⠀⠄⠂⠔⠁⣮⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠝⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣤⠤⣤⣴⣛⠕⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠫⠛⢟⣷⣦⣰⠢⠄⠐⡰⠚⣜⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢿⡟⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⢀⣴⣶⠚⠖⠾⠊⠉⠠⠀⠀⠀⠀⠀⠀⠄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠐⠀⠀⠀⠀⠠⡀⠐⡀⠐⠑⠻⠿⣿⣾⣀⣿⣇⣾⣿⣿⣿⣿⣿⣿⡿⠿⠉⠂⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⣴⣿⡟⢁⠅⠀⠀⠀⠀⠁⢀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠁⠐⢸⠀⠠⠀⢀⡁⠙⣿⣼⣶⣿⣿⣿⣿⡿⠛⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢸⣿⢳⠓⠁⠀⠀⠠⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠄⠀⠀⠀⠨⠁⠄⠆⣠⣾⣿⣆⡉⠁⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⣿⣧⠅⠀⠀⠀⢀⠀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡄⠀⠀⠀⠀⢀⣠⣿⣿⣿⣿⣿⢿⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢻⣿⢴⠀⠀⠀⢬⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡠⠁⠀⠀⠄⣘⣿⣿⣿⣿⣿⡿⠟⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠈⣿⣯⡵⡄⠀⠈⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠂⠀⠀⠀⠀⠌⠀⠀⠠⣰⣾⣿⣿⣿⣿⣿⠏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠘⣿⣖⡟⠀⠀⠀⠀⢀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠄⠀⠀⠀⠀⡀⢀⠔⠀⠠⣠⣾⣿⣿⣿⣿⠟⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠾⣿⣿⣿⣧⣰⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⠀⠁⢠⣦⣿⣿⣿⣿⣿⡿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠘⢿⣿⣿⣿⣧⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠀⠀⠀⠀⠀⠀⠁⠀⡀⣼⣿⣿⣿⣿⣿⠯⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠈⠛⢿⣿⣿⡿⣧⣠⡀⠀⠀⠀⠀⢀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠴⠂⠀⠀⠀⠀⣽⣾⣿⣿⣿⣿⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⢽⣿⣿⣟⡷⣷⣦⣄⣤⡀⠉⠉⠁⠂⠒⠀⠀⠀⠀⠀⠀⠀⠀⣀⠔⣼⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠻⢿⣿⣿⣾⣿⣿⣛⣳⣶⣦⢤⣄⣀⡄⣀⣀⣀⣢⣤⣾⣶⣾⣿⣿⣿⠟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠙⠻⢿⣿⣿⢿⣿⣿⣿⣿⣾⣽⣿⣾⣯⣿⣿⣿⣿⣿⣿⣿⠟⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠛⠻⠾⠿⢿⣿⣿⣿⣿⣿⣿⠿⡿⠟⠛⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
								</pre>
								<p class="text-xs">Send a request to see the response here.</p>
							</div>
						{/if}
					</div>
				</div>
				<div
					class="flex flex-shrink-0 flex-col-reverse items-center justify-end gap-2 border-t border-border px-2 py-2 text-xs text-muted-foreground sm:flex-row sm:px-3 sm:py-3 lg:px-6 lg:py-3"
				>
					<div class="flex flex-wrap items-center justify-center gap-1 sm:gap-2">
						Send Request
						<span
							class="rounded-md border border-border bg-muted px-1 py-1 text-xs text-foreground sm:px-2 sm:py-1"
						>
							Ctrl
						</span>
						<span
							class="rounded-md border border-border bg-muted px-1 py-1 text-xs text-foreground sm:px-2 sm:py-1"
						>
							Enter
						</span>
					</div>
					{#if responseDurationMs != null}
						<span class="text-foreground">{responseDurationMs}ms</span>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/snippet}

<Dialog.Root bind:open>
	<Button
		size="sm"
		variant="outline"
		class="gap-2"
		onclick={() => {
			const nextQueryRows = createInitialQueryRows();
			queryRows = nextQueryRows;
			requestAccordion = ['query', 'body', 'snippet'];
			open = true;
		}}
	>
		Open API Client
	</Button>
	<Dialog.Content
		class="flex h-[90vh] w-[98vw] max-w-7xl flex-col overflow-hidden border border-border bg-card p-0 text-card-foreground shadow-2xl sm:h-[88vh] sm:w-[95vw] lg:h-[84vh] lg:w-[96vw]"
	>
		{@render panelContent()}
	</Dialog.Content>
</Dialog.Root>
