<script>
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import CommandMenu from '$lib/components/command-menu.svelte';
	import { commandMenuOpen } from '$lib/stores/command-menu.js';
	import * as Breadcrumb from '$lib/components/ui/breadcrumb/index.js';
	import * as Menubar from '$lib/components/ui/menubar/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { initOpenApi, openapiStatus } from '$lib/stores/openapi.js';
	import Button from '$lib/components/ui/button/button.svelte';

	let { children } = $props();

	// todo: make the top bar sticky

	onMount(() => {
		initOpenApi();
	});

	/* =========================
	   Breadcrumbs
	========================= */

	const breadcrumbs = $derived.by(() => {
		const segments = page.url.pathname.split('/').filter(Boolean);

		const crumbs = [];
		let path = '';

		for (const segment of segments) {
			path += `/${segment}`;
			crumbs.push({
				label: decodeURIComponent(segment).replace(/_/g, ' ').replace(/-/g, ' '),
				href: path
			});
		}

		return crumbs;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ModeWatcher />

<Sidebar.Provider>
	<AppSidebar />

	<Sidebar.Inset>
		<header
			class="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur"
		>
			<Sidebar.Trigger class="-ms-1" />
			<Separator orientation="vertical" class="me-2 data-[orientation=vertical]:h-4" />

			<Breadcrumb.Root>
				<Breadcrumb.List>
					{#if breadcrumbs.length === 0}
						<Breadcrumb.Item>
							<Breadcrumb.Link href="/">Home</Breadcrumb.Link>
						</Breadcrumb.Item>
					{:else}
						{#each breadcrumbs as crumb, index}
							<Breadcrumb.Item>
								{#if index < breadcrumbs.length - 1}
									<Breadcrumb.Link href={crumb.href}>
										{crumb.label}
									</Breadcrumb.Link>
								{:else}
									<Breadcrumb.Page>
										{crumb.label}
									</Breadcrumb.Page>
								{/if}
							</Breadcrumb.Item>
						{/each}
					{/if}
				</Breadcrumb.List>
			</Breadcrumb.Root>

			<div class="ms-auto flex items-center gap-2">
				<Button variant="outline" onclick={() => commandMenuOpen.set(true)}>Menu</Button>
			</div>
		</header>

		<div
			class="flex flex-1 flex-col gap-6 bg-linear-to-br from-background via-background to-muted/40 px-6 py-8"
		>
			{#if $openapiStatus.state === 'loading'}
				<div class="text-muted-foreground">Loading API documentation…</div>
			{:else}
				{@render children()}
			{/if}
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

<CommandMenu />
