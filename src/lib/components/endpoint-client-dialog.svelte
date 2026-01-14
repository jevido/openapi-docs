<script>
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import { schemaToExample } from '$lib/api/openapi.js';

	let { endpoint, doc, baseUrl } = $props();

	let open = $state(true);
	let bearerToken = $state('');
	let responseText = $state('');
	let responseStatus = $state('');
	let errorText = $state('');
	let loading = $state(false);

	function methodBadgeClass(method) {
		switch (method) {
			case 'GET':
				return 'bg-primary/10 text-primary';
			case 'POST':
				return 'bg-secondary text-secondary-foreground';
			case 'PUT':
				return 'bg-accent text-accent-foreground';
			case 'PATCH':
				return 'bg-muted text-foreground';
			case 'DELETE':
				return 'bg-destructive/10 text-destructive';
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

	let requestUrl = $derived.by(() => joinUrl(baseUrl, endpoint.path));
	let requestUrlDraft = $state('');
	let requestUrlDirty = $state(false);
	let requestUrlValue = $derived.by(() => (requestUrlDirty ? requestUrlDraft : requestUrl));

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

	async function sendRequest() {
		loading = true;
		errorText = '';
		responseText = '';
		responseStatus = '';

		const url = requestUrlValue.trim() || requestUrl;
		const headers = {
			Accept: 'application/json'
		};

		if (bearerToken.trim()) {
			headers.Authorization = `Bearer ${bearerToken.trim()}`;
		}

		const supportsBody = !['GET', 'HEAD'].includes(endpoint.method);
		let body;

		if (supportsBody && bodyTextValue.trim()) {
			headers['Content-Type'] = 'application/json';
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
		} catch (error) {
			errorText = error?.message ?? 'Request failed.';
		} finally {
			loading = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Button size="sm" variant="outline" class="gap-2" onclick={() => (open = true)}>
		<span class="size-2 rounded-full bg-primary"></span>
		Open API Client
	</Button>
	<Dialog.Content
		class="h-[84vh] w-[96vw] max-w-7xl overflow-hidden border border-border bg-card p-0 text-card-foreground shadow-2xl"
	>
		<div class="flex h-full flex-col">
			<div class="border-b border-border bg-muted/40 px-6 py-4">
				<div class="flex flex-wrap items-center gap-3">
					<InputGroup.Root class="max-w-3xl">
						<InputGroup.Addon>
							<Badge variant="outline" class={methodBadgeClass(endpoint.method)}>
								{endpoint.method}
							</Badge>
						</InputGroup.Addon>
						<InputGroup.Input
							class="text-xs text-foreground"
							value={requestUrlValue}
							placeholder={requestUrl}
							on:input={(event) => {
								const value = event.currentTarget.value;
								requestUrlDraft = value;
								requestUrlDirty = value !== requestUrl;
							}}
							on:focus={(event) => event.currentTarget?.select()}
						/>
					</InputGroup.Root>
					<Button size="sm" onclick={sendRequest} disabled={loading}>
						{loading ? 'Sending...' : 'Send'}
					</Button>
				</div>
			</div>

			<div class="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
				<div class="flex min-h-0 flex-col border-b border-border lg:border-r lg:border-b-0">
					<div
						class="border-b border-border px-6 py-3 text-xs tracking-[0.2em] text-muted-foreground uppercase"
					>
						Request Builder
					</div>
					<div
						class="w-full flex-1 space-y-4 overflow-auto px-6 py-4 text-xs text-muted-foreground"
					>
						<div class="space-y-2">
							<p class="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
								Authentication
							</p>
							<InputGroup.Root>
								<InputGroup.Addon>
									<InputGroup.Text>Bearer</InputGroup.Text>
								</InputGroup.Addon>
								<InputGroup.Input class="text-xs" placeholder="Token" bind:value={bearerToken} />
							</InputGroup.Root>
						</div>

						<div class="space-y-2">
							<p class="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
								Request Body
							</p>
							<InputGroup.Root>
								<InputGroup.Addon align="block-start">
									<InputGroup.Text class="font-mono text-[10px] tracking-[0.2em] uppercase">
										JSON
									</InputGroup.Text>
								</InputGroup.Addon>
								<InputGroup.Textarea
									class="min-h-52 w-full resize-y font-mono text-xs"
									placeholder={'{}'}
									value={bodyTextValue}
									on:input={(event) => {
										const value = event.currentTarget.value;
										bodyTextDraft = value;
										bodyTextDirty = value !== bodyTextDefault;
									}}
								/>
							</InputGroup.Root>
						</div>

						<div class="space-y-2">
							<p class="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">Headers</p>
							<div class="grid grid-cols-[1fr_1fr] gap-2">
								<div class="rounded-md border border-border bg-muted px-3 py-2 text-foreground">
									Accept
								</div>
								<div class="rounded-md border border-border bg-muted px-3 py-2 text-foreground">
									application/json
								</div>
							</div>
						</div>

						<div class="space-y-2">
							<p class="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
								Code Snippet
							</p>
							<pre
								class="overflow-auto rounded-md border border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
curl -X {endpoint.method} "{requestUrlValue}" \
{#if bearerToken.trim()}
									-H "Authorization: Bearer {bearerToken.trim()}" \
								{/if}
  -H "Content-Type: application/json"
							</pre>
						</div>
					</div>
				</div>

				<div class="flex min-h-0 flex-col">
					<div
						class="border-b border-border px-6 py-3 text-xs tracking-[0.2em] text-muted-foreground uppercase"
					>
						Response
					</div>
					<div class="flex-1 overflow-auto px-6 py-6">
						{#if errorText}
							<div
								class="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive"
							>
								{errorText}
							</div>
						{:else if responseText}
							<div class="space-y-3">
								<p class="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
									{responseStatus}
								</p>
								<pre
									class="rounded-md border border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-foreground">
{responseText}
								</pre>
							</div>
						{:else}
							<div
								class="flex h-full flex-col items-center justify-center gap-6 text-muted-foreground"
							>
								<pre class="text-[10px] leading-tight text-muted-foreground">
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⣤⣶⣲⣻⣿⢯⡿⣟⣿⣟⣶⣶⣤⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣤⢖⣿⡿⣷⢿⡻⣿⣽⡻⣽⡻⣽⣯⣿⣿⣿⣽⣿⣿⣿⣷⣦⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣠⣴⢺⡝⣲⣟⡞⣟⢧⣻⣝⢮⣽⣳⢽⣹⢷⣿⡞⣿⡿⣿⣽⣿⣿⣿⣿⣿⣿⣶⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⢔⣶⡝⡽⡜⣥⢧⣚⡱⣎⡳⣭⢶⣳⢮⢿⣜⣳⢯⣟⣮⢷⣻⣷⣻⢯⣿⣯⣿⣿⣿⣿⣿⣿⣿⣿⣦⡄⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣴⣯⢳⡌⡖⣩⢳⣛⣮⣦⣳⣽⣚⣵⣹⣎⣿⣯⣛⣯⣟⣻⣾⣹⣯⣷⣯⣿⣟⣿⣻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⡀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡴⣿⣿⠸⣬⢧⢧⡷⣯⢿⠻⣾⣿⢿⣿⡿⢿⣿⡿⣿⠿⡿⣿⣿⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣄⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣖⡟⡯⢖⢦⡳⣩⣞⡎⠷⡽⣭⢓⣮⢳⢧⣖⡽⣳⣭⢿⣫⢿⣟⣽⣷⣻⣿⣾⣯⡿⣽⣿⣻⣿⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣯⣻⠄⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣴⣿⣾⣫⣯⣝⡎⠶⣵⢇⡞⣽⣫⡷⣭⣻⡼⣹⣶⣫⢷⣳⡽⡷⣯⣽⣿⣿⣷⣏⣿⣿⣿⣽⣿⣿⣯⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡝⡞⡄
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⣿⠿⣟⣛⠛⠽⠽⠿⣫⣝⡾⣽⣾⣣⠟⣼⣣⢿⡞⣷⢯⣷⢿⣿⢿⡿⣽⡿⣿⣯⣿⣽⣷⣟⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣟⣼⠃
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣼⡝⠊⣼⣎⠍⠋⣠⠤⣌⢐⣬⠒⣊⢛⠻⣷⢾⣿⣻⣿⣻⣿⣿⣿⣿⣿⣻⣟⣿⣿⣿⢾⣽⣿⣾⣿⣟⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡽⣞⣧
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⣷⠊⠨⠁⡀⠈⠀⠘⡠⢕⠈⠀⡯⡄⠑⠠⡨⠝⣻⣿⣿⣿⣯⢯⣿⣿⣽⣿⢿⣻⡿⣿⣳⣿⣿⣿⣽⣿⣿⣿⣿⣿⣽⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢿⣻⢿⡉
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢟⣬⣢⠰⡎⢂⡰⠆⡈⡲⠗⡤⡃⠀⠀⠀⠀⠕⠦⣰⠙⢛⢿⣿⣿⣾⣿⣽⣿⣻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣟⣻⡞⠇⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢟⣎⠱⠀⠱⣀⡄⡈⠂⠀⠠⠆⠹⠀⡀⠀⣄⠀⠈⠃⢬⠛⢝⢻⣿⢿⣿⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣟⡞⣧⠟⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢻⡩⠀⢵⡁⠀⠀⠐⠁⠡⣊⢆⡀⠲⠢⠁⠠⠒⠈⠄⡠⠀⠇⢙⠷⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣯⣟⣞⡇⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⢯⢄⡳⡀⠀⠀⠀⠐⣁⠎⢈⠌⡖⠜⡨⢫⡀⠠⠀⠘⠀⠂⡀⠂⠘⣻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⣾⡽⠆⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢰⡯⢢⡈⡓⠀⢀⡢⠁⠐⡓⠂⡘⠈⠀⠀⠀⡄⠀⢀⠂⢴⠀⠅⠀⡈⢄⣘⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⣽⣳⢟⠇⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣿⠄⠢⠀⠢⠈⠀⠀⠀⠁⠈⠁⠀⠀⠒⠀⠁⡰⠆⣀⠈⠂⠀⠊⠀⠀⠀⢿⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣻⡷⣯⢿⠍⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣿⠓⢄⠈⢀⡀⠄⠀⠀⠤⠖⢈⠢⠀⠀⠑⡀⡀⠌⡁⠀⠀⢲⠀⠀⢈⠈⣤⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣟⣿⣳⣟⡻⠂⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢻⣻⣀⠀⢀⠀⠀⠶⡄⠀⠀⠀⠀⠀⠀⣠⡷⢀⡆⡄⢰⣼⠇⣀⢦⡇⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣿⠗⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣤⣤⣶⠶⣣⡍⣆⠈⡠⢄⡐⠀⠀⠀⠀⠀⠀⣀⠕⠁⠌⠁⢀⠈⠀⠀⣿⡼⢠⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣿⡾⡿⠋⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡠⣲⠿⠋⠉⠀⠀⠀⠙⡿⢿⣤⣄⠔⣘⠁⠄⠀⠀⠀⢁⠀⠈⡀⠀⠀⠀⠀⡠⡅⡀⢣⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⣿⢿⣟⣯⠝⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣶⣿⠛⠁⠀⠒⠉⠀⠀⠀⠀⠀⠈⠑⠻⠿⢶⣤⣨⠵⠄⠀⠀⠀⠂⠐⠐⣋⠠⠋⢪⠠⠥⣗⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⣯⢷⡿⠝⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⣲⡟⠙⠉⠀⢀⠤⠐⠈⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠑⠻⢶⠯⣴⡞⣠⣂⣤⠗⠀⠄⠂⠔⠁⣮⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠝⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣤⠤⣤⣴⣛⠕⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠫⠛⢟⣷⣦⣰⠢⠄⠐⡰⠚⣜⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢿⡟⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
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
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠛⠻⠾⠿⢿⣿⣿⣿⣿⣿⣿⣿⠿⡿⠟⠛⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
								</pre>
								<p class="text-xs">Send a request to see the response here.</p>
							</div>
						{/if}
					</div>
					<div
						class="flex items-center justify-end gap-1 border-t border-border px-6 py-3 text-xs text-muted-foreground"
					>
						Send Request
						<span class="rounded-md border border-border bg-muted px-2 py-1 text-foreground"
							>Ctrl</span
						>
						<span class="rounded-md border border-border bg-muted px-2 py-1 text-foreground">
							Enter
						</span>
					</div>
				</div>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
