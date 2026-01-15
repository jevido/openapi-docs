<script>
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import SearchForm from './search-form.svelte';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { useSidebar } from '$lib/components/ui/sidebar/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { getEndpointsByTag } from '$lib/api/openapi.js';
	import {
		addOpenApiSource,
		activeOpenApiSource,
		openapiSources,
		openapiSpecs,
		removeOpenApiSource,
		setActiveOpenApiSource
	} from '$lib/stores/openapi.js';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';

	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import GalleryVerticalEndIcon from '@lucide/svelte/icons/gallery-vertical-end';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	let { ref = $bindable(null), ...restProps } = $props();
	const sidebar = useSidebar();

	const pathname = $derived(page.url.pathname);
	let query = $state('');
	let addDialogOpen = $state(false);
	let newSourceUrl = $state('');
	let addError = $state('');

	const endpointsByTag = $derived.by(() =>
		$openapiSpecs ? getEndpointsByTag($openapiSpecs) : {}
	);

	const activeTitle = $derived.by(() => {
		if ($openapiSpecs?.info?.title) return $openapiSpecs.info.title;
		return $activeOpenApiSource?.name ?? 'Documentation';
	});

	const activeSubtitle = $derived.by(() => {
		if ($openapiSpecs?.info?.version) return `v${$openapiSpecs.info.version}`;
		return $activeOpenApiSource?.url ?? '';
	});

	/* =========================
	   Filtered nav grouped per tag
	========================= */
	const navMain = $derived.by(() => {
		if (!$openapiSpecs) return [];

		const needle = query.trim().toLowerCase();
		const result = [];

		for (const [tag, endpoints] of Object.entries(endpointsByTag)) {
			const filtered = endpoints.filter((op) => {
				if (!needle) return true;
				return (
					op.path.toLowerCase().includes(needle) ||
					op.summary.toLowerCase().includes(needle) ||
					op.method.toLowerCase().includes(needle)
				);
			});

			if (!filtered.length) continue;

			result.push({
				title: tag,
				url: slugify(tag),
				isOpen: pathname.startsWith(slugify(tag)),
				items: filtered.map((op) => ({
					title: op.summary || `${op.method} ${op.path}`,
					url: `${slugify(tag)}#${op.path}-${op.method}`,
					method: op.method,
					isActive: false
				}))
			});
		}

		return result;
	});

	function openAddDialog() {
		addDialogOpen = true;
		addError = '';
		newSourceUrl = '';
	}

	async function handleAddSource(event) {
		event.preventDefault();
		if (!newSourceUrl.trim()) {
			addError = 'Enter a valid OpenAPI URL.';
			return;
		}
		const result = await addOpenApiSource({ url: newSourceUrl });
		if (!result?.ok) {
			addError = 'Unable to load that OpenAPI URL.';
			return;
		}
		addDialogOpen = false;
		await goto('/');
	}

	async function handleSourceSelect(id) {
		await setActiveOpenApiSource(id);
		await goto('/');
	}

	async function handleRemoveSource(event, id) {
		event.preventDefault();
		event.stopPropagation();
		await removeOpenApiSource(id);
		await goto('/');
	}

	function slugify(value) {
		return value.replace(/[^A-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
	}

	function methodClass(method) {
		switch (method) {
			case 'GET':
				return 'text-emerald-400';
			case 'POST':
				return 'text-sky-400';
			case 'PUT':
				return 'text-indigo-400';
			case 'PATCH':
				return 'text-amber-400';
			case 'DELETE':
				return 'text-rose-400';
			default:
				return 'text-muted-foreground';
		}
	}
</script>

<Sidebar.Root bind:ref {...restProps} class="sidebar-font">
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Sidebar.MenuButton
								{...props}
								size="lg"
								class="text-sm data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
							>
								<div
									class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
								>
									<GalleryVerticalEndIcon class="size-4" />
								</div>
								<div class="grid flex-1 text-start text-sm leading-tight">
									<span class="truncate font-medium">{activeTitle}</span>
									<span class="truncate text-xs">{activeSubtitle}</span>
								</div>
								<ChevronsUpDownIcon class="ms-auto size-4" />
							</Sidebar.MenuButton>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content
						class="w-(--bits-dropdown-menu-anchor-width) min-w-64 rounded-lg"
						align="start"
						side={sidebar.isMobile ? 'bottom' : 'right'}
						sideOffset={4}
					>
						<DropdownMenu.Label class="text-muted-foreground text-xs">
							Documentation
						</DropdownMenu.Label>
						{#each $openapiSources as source, index (source.id)}
							<DropdownMenu.Item
								onSelect={() => handleSourceSelect(source.id)}
								class="gap-2 p-2"
							>
								<div class="flex size-6 items-center justify-center rounded-md border">
									<GalleryVerticalEndIcon class="size-3.5 shrink-0" />
								</div>
								<div class="grid flex-1 text-start text-xs leading-tight">
									<span class="truncate font-medium">{source.name}</span>
									<span class="truncate text-muted-foreground">{source.url}</span>
								</div>
								<button
									type="button"
									class="ms-auto inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/60 hover:text-destructive"
									aria-label={`Remove ${source.name}`}
									onclick={(event) => handleRemoveSource(event, source.id)}
								>
									<Trash2Icon class="size-3.5" />
								</button>
								<DropdownMenu.Shortcut>{index + 1}</DropdownMenu.Shortcut>
							</DropdownMenu.Item>
						{/each}
						<DropdownMenu.Separator />
						<DropdownMenu.Item class="gap-2 p-2" onSelect={openAddDialog}>
							<div class="flex size-6 items-center justify-center rounded-md border bg-transparent">
								<PlusIcon class="size-4" />
							</div>
							<div class="text-muted-foreground font-medium">Add documentation</div>
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</Sidebar.MenuItem>
		</Sidebar.Menu>

		<SearchForm bind:value={query} />
	</Sidebar.Header>

	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.Menu>
				<Sidebar.MenuItem>
					<Sidebar.MenuButton isActive={pathname === '/'} class="text-sm">
						{#snippet child({ props })}
							<a href="/" {...props}>
								<GalleryVerticalEndIcon class="size-4" />
								Overview
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			</Sidebar.Menu>
		</Sidebar.Group>
		<Sidebar.Group>
			<Sidebar.Menu>
				{#each navMain as tagItem, index}
					<Collapsible.Root open={tagItem.isOpen || index === 0} class="group/collapsible">
						<Sidebar.MenuItem>
							<Collapsible.Trigger>
								{#snippet child({ props })}
									<Sidebar.MenuButton {...props} class="text-sm">
										{tagItem.title}
										<PlusIcon class="ms-auto group-data-[state=open]/collapsible:hidden" />
										<MinusIcon class="ms-auto group-data-[state=closed]/collapsible:hidden" />
									</Sidebar.MenuButton>
								{/snippet}
							</Collapsible.Trigger>

							{#if tagItem.items?.length}
								<Collapsible.Content>
									<Sidebar.MenuSub>
										{#each tagItem.items as endpoint}
											<Sidebar.MenuSubItem class="p-0">
												<Sidebar.MenuSubButton isActive={endpoint.isActive} size="sm">
													{#snippet child({ props })}
														<Button
															variant="ghost"
															{...props}
															href={endpoint.url}
															class="h-auto w-full py-0 px-1 items-start justify-between gap-2 whitespace-normal text-sm leading-snug text-left"
														>
															<span class="min-w-0 flex-1 break-words text-pretty">
																{endpoint.title}
															</span>
															<Badge
																variant="outline"
																class={`shrink-0 self-start ${methodClass(endpoint.method)}`}
																>{endpoint.method}</Badge
															>
														</Button>
													{/snippet}
												</Sidebar.MenuSubButton>
											</Sidebar.MenuSubItem>
										{/each}
									</Sidebar.MenuSub>
								</Collapsible.Content>
							{/if}
						</Sidebar.MenuItem>
					</Collapsible.Root>
				{/each}
			</Sidebar.Menu>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Rail />
</Sidebar.Root>

<Dialog.Root bind:open={addDialogOpen}>
	<Dialog.Content class="sm:max-w-[420px]">
		<Dialog.Header>
			<Dialog.Title>Add documentation</Dialog.Title>
			<Dialog.Description>Paste an OpenAPI JSON URL to add it to the list.</Dialog.Description>
		</Dialog.Header>
		<form class="grid gap-4 py-4" onsubmit={handleAddSource}>
			<div class="grid gap-2">
				<label class="text-sm font-medium">OpenAPI URL</label>
				<Input
					type="url"
					placeholder="https://example.com/openapi.json"
					bind:value={newSourceUrl}
				/>
			</div>
			{#if addError}
				<p class="text-sm text-destructive">{addError}</p>
			{/if}
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (addDialogOpen = false)}>
					Cancel
				</Button>
				<Button type="submit">Add</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
