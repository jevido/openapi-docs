<script>
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { page } from '$app/state';

	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { getOperations } from '$lib/api/openapi.js';

	let { children, data } = $props();

	const spec = $derived(data?.spec ?? null);
	const specError = $derived(data?.error ?? null);
	const operations = $derived(spec ? getOperations(spec) : []);
	const pathname = $derived(page.url.pathname);
	const operationParam = $derived(page.params?.operationId ?? '');
	const activeOperationId = $derived.by(() => {
		if (!operationParam) return '';
		try {
			return decodeURIComponent(operationParam);
		} catch {
			return operationParam;
		}
	});
	const activeOperation = $derived.by(() => {
		if (!activeOperationId) return null;
		return operations.find((operation) => operation.operationId === activeOperationId) ?? null;
	});

	const breadcrumbs = $derived.by(() => buildBreadcrumbs(pathname, activeOperation));

	function buildBreadcrumbs(path, operation) {
		const crumbs = [{ label: 'Docs', href: '/' }];

		if (path === '/') {
			return [{ label: 'Docs', href: '/', current: true }];
		}

		if (path.startsWith('/reference')) {
			crumbs.push({ label: 'API Reference', href: '/reference' });
			if (operation) {
				crumbs.push({ label: operation.summary || operation.operationId, current: true });
			} else {
				crumbs[crumbs.length - 1].current = true;
			}
			return crumbs;
		}

		if (path === '/schemas') {
			crumbs.push({ label: 'Schemas', current: true });
			return crumbs;
		}

		if (path === '/client') {
			crumbs.push({ label: 'Client', current: true });
			return crumbs;
		}

		crumbs.push({ label: path.replace('/', ''), current: true });
		return crumbs;
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<ModeWatcher />

<Sidebar.Provider>
	<AppSidebar {spec} />
	<Sidebar.Inset>
		<header class="flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
			<Sidebar.Trigger class="-ms-1" />
			<Separator orientation="vertical" class="me-2 data-[orientation=vertical]:h-4" />
			<Breadcrumb.Root>
				<Breadcrumb.List>
					{#each breadcrumbs as crumb, index (crumb.label)}
						<Breadcrumb.Item class={crumb.current ? '' : 'hidden md:block'}>
							{#if crumb.current}
								<Breadcrumb.Page>{crumb.label}</Breadcrumb.Page>
							{:else}
								<Breadcrumb.Link href={crumb.href}>{crumb.label}</Breadcrumb.Link>
							{/if}
						</Breadcrumb.Item>
						{#if index < breadcrumbs.length - 1}
							<Breadcrumb.Separator class="hidden md:block" />
						{/if}
					{/each}
				</Breadcrumb.List>
			</Breadcrumb.Root>
			<div class="ms-auto hidden items-center gap-2 md:flex">
				<Button variant="ghost" size="sm">Share</Button>
				<Button variant="ghost" size="sm">Generate SDKs</Button>
				<Button variant="ghost" size="sm">Configure</Button>
			</div>
			{#if specError}
				<span class="ms-auto text-xs text-destructive">{specError}</span>
			{/if}
		</header>
		<div class="flex flex-1 flex-col gap-6 bg-gradient-to-br from-background via-background to-muted/40 px-6 py-8">
			{@render children()}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>
