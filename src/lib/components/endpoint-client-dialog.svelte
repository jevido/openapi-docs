<script>
	import { page } from '$app/state';
	import Editor from './editor.svelte';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import { schemaToExample } from '$lib/api/openapi.js';
	import { cn } from '$lib/utils';
	import { createSDK } from 'jevido-sdk';
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

	let beforeRequestScript = $state('');
	let afterResponseScript = $state('');
	let sdk = $state(null);

	// todo: remove manual fetch use jevido-sdk instead
	// todo: implement a way to share the requests/response scripts
	// todo: allow injecting variables to the request body, such as {token} or {user.id}

	function getStorageKey(prefix) {
		const endpointId = `${endpoint.path}::${endpoint.method}`;
		return `endpoint-scripts:${endpointId}:${prefix}`;
	}

	function loadScriptFromStorage(prefix) {
		if (typeof localStorage === 'undefined') return '';
		try {
			return localStorage.getItem(getStorageKey(prefix)) || '';
		} catch {
			return '';
		}
	}

	function saveScriptToStorage(prefix, script) {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(getStorageKey(prefix), script);
		} catch {
			console.error('Failed to save script to localStorage');
		}
	}

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

	let bodyTextDraft = $state('');
	let bodyTextDirty = $state(false);
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
		let url = requestUrlWithParams.trim() || requestUrl;
		const absoluteUrl = toAbsoluteUrl(url);

		const supportsBody = !['GET', 'HEAD'].includes(endpoint.method);
		let body = supportsBody && bodyTextValue.trim() ? bodyTextValue : undefined;

		let headers = buildHeaders({ includeContentType: supportsBody });

		// Execute before-request script
		if (beforeRequestScript.trim()) {
			try {
				const requestContext = {
					url,
					method: endpoint.method,
					headers,
					body,
					// Allow modifying request properties
					setUrl(newUrl) {
						url = newUrl;
					},
					setBody(newBody) {
						body = newBody;
					},
					setHeader(key, value) {
						headers[key] = value;
					},
					removeHeader(key) {
						delete headers[key];
					}
				};

				// Create function from script and execute it
				const beforeFn = new Function(
					'request',
					'sdk',
					`return (async () => {
  ${beforeRequestScript}
})()`
				);
				await beforeFn(requestContext, sdk);
			} catch (error) {
				errorText = `Before Request Script Error: ${error?.message ?? 'Unknown error'}`;
				responseDurationMs = Math.round(performance.now() - start);
				loading = false;
				return;
			}
		}

		try {
			const res = await fetch(url, {
				method: endpoint.method,
				headers,
				body
			});

			responseStatus = `${res.status} ${res.statusText}`;
			const text = await res.text();

			let parsedResponse;
			try {
				parsedResponse = JSON.parse(text);
				responseText = JSON.stringify(parsedResponse, null, 2);
			} catch {
				responseText = text;
				parsedResponse = text;
			}

			// Execute after-response script
			if (afterResponseScript.trim()) {
				try {
					const responseContext = {
						status: res.status,
						statusText: res.statusText,
						headers: Object.fromEntries(res.headers.entries()),
						body: parsedResponse,
						text,
						// Allow modifying response display
						setResponseText(newText) {
							responseText = newText;
						}
					};

					// Create function from script and execute it
					const afterFn = new Function(
						'response',
						'sdk',
						`return (async () => {
  ${afterResponseScript}
})()`
					);
					await afterFn(responseContext, sdk);
				} catch (error) {
					console.error('After Response Script Error:', error);
					// Don't fail the request, just log the error
				}
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

	$effect(async () => {
		// Load scripts and initialize SDK when dialog opens
		if (open) {
			beforeRequestScript = loadScriptFromStorage('before-request');
			afterResponseScript = loadScriptFromStorage('after-response');

			// Initialize SDK
			if (specUrl) {
				try {
					sdk = await createSDK(specUrl);
				} catch (error) {
					console.error('Failed to initialize SDK:', error);
					sdk = null;
				}
			}
		}
	});

	$effect(() => {
		// Save scripts when they change
		if (open) {
			saveScriptToStorage('before-request', beforeRequestScript);
		}
	});

	$effect(() => {
		// Save scripts when they change
		if (open) {
			saveScriptToStorage('after-response', afterResponseScript);
		}
	});
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
				<Tabs.Root value="request" class="flex min-h-0 flex-col">
					<Tabs.List
						class="w-full justify-start rounded-none border-b border-border bg-muted/40 px-2 sm:px-3 lg:px-6"
					>
						<Tabs.Trigger value="before-request" class="rounded-t-md">Before Request</Tabs.Trigger>
						<Tabs.Trigger value="request" class="rounded-t-md">Request Builder</Tabs.Trigger>
						<Tabs.Trigger value="after-response" class="rounded-t-md">After Response</Tabs.Trigger>
						<Button
							size="icon-sm"
							variant="ghost"
							aria-label="View response"
							class="ml-auto lg:hidden"
							onclick={() => (mobileViewMode = 'response')}
						>
							→
						</Button>
					</Tabs.List>

					<Tabs.Content value="before-request" class="min-h-0 flex-1 overflow-y-auto">
						<div
							class="h-auto w-full space-y-2 px-2 py-2 text-xs text-muted-foreground sm:px-3 sm:py-3 lg:px-6 lg:py-4"
						>
							<div class="mb-4 rounded-md bg-muted/20 p-3">
								<p class="text-xs text-muted-foreground">
									JavaScript executed before sending the request. Access request details via the <code
										class="rounded bg-muted px-1">request</code
									>
									object and the SDK via <code class="rounded bg-muted px-1">sdk</code>.
								</p>
							</div>
							<Editor
								language="javascript"
								bind:value={beforeRequestScript}
								handleSubmit={sendRequest}
							/>
						</div>
					</Tabs.Content>

					<Tabs.Content value="request" class="min-h-0 flex-1 overflow-y-auto">
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
													<Checkbox
														bind:checked={row.enabled}
														disabled={isPathParameter(row.key)}
													/>
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
					</Tabs.Content>

					<Tabs.Content value="after-response" class="min-h-0 flex-1 overflow-y-auto">
						<div
							class="h-auto w-full space-y-2 px-2 py-2 text-xs text-muted-foreground sm:px-3 sm:py-3 lg:px-6 lg:py-4"
						>
							<div class="mb-4 rounded-md bg-muted/20 p-3">
								<p class="text-xs text-muted-foreground">
									JavaScript executed after receiving the response. Access the response via the <code
										class="rounded bg-muted px-1">response</code
									>
									object and the SDK via <code class="rounded bg-muted px-1">sdk</code>.
								</p>
							</div>
							<Editor
								language="javascript"
								bind:value={afterResponseScript}
								handleSubmit={sendRequest}
							/>
						</div>
					</Tabs.Content>
				</Tabs.Root>
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
								<div class="overflow-hidden rounded-md border border-border">
									<Editor language="json" disabled={true} value={responseText} />
								</div>
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
