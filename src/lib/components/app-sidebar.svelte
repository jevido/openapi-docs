<script>
	import { page } from '$app/state';
	import SearchForm from './search-form.svelte';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { getTags, getEndpointsByTag, specs } from '$lib/api/openapi.js';
	import { Badge } from '$lib/components/ui/badge';

	import GalleryVerticalEndIcon from '@lucide/svelte/icons/gallery-vertical-end';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';

	let { ref = $bindable(null), ...restProps } = $props();

	const pathname = $derived(page.url.pathname);

	let query = $state('');

	/* =========================
	   Derived OpenAPI data
	========================= */

	const tags = $derived(specs ? getTags(specs) : []);
	const endpointsByTag = $derived(specs ? getEndpointsByTag(specs) : {});

	const displayTitle = $derived(specs?.info?.title ?? 'Documentation');
	const displayVersion = $derived(specs?.info?.version ? `v${specs.info.version}` : 'v1.0.0');

	/* =========================
	   Filtered nav
	========================= */

	const navMain = $derived.by(() => {
		if (!specs) return [];

		const result = [];

		for (const [tag, endpoints] of Object.entries(endpointsByTag)) {
			const filtered = endpoints.filter((op) => {
				if (!query.trim()) return true;
				const needle = query.toLowerCase();

				return (
					op.path.toLowerCase().includes(needle) ||
					op.summary.toLowerCase().includes(needle) ||
					op.method.toLowerCase().includes(needle)
				);
			});

			if (!filtered.length) continue;

			result.push({
				title: tag,
				url: `#${slugify(tag)}`,
				isOpen: filtered.some((item) => pathname === buildEndpointUrl(item)),
				items: filtered.map((op) => ({
					title: op.summary || `${op.method} ${op.path}`,
					url: buildEndpointUrl(op),
					method: op.method,
					isActive: pathname === buildEndpointUrl(op)
				}))
			});
		}

		return result;
	});

	function buildEndpointUrl(op) {
		// You can change this to match your routing strategy
		// Example: /reference/GET/guilds
		const safePath = op.path.replace(/\//g, '_').replace(/^_/, '');
		return `/reference/${op.method}/${safePath}`;
	}

	function slugify(value) {
		return value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)+/g, '');
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

<Sidebar.Root bind:ref {...restProps}>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg">
					{#snippet child({ props })}
						<a href="/" {...props}>
							<div
								class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
							>
								<GalleryVerticalEndIcon class="size-4" />
							</div>
							<div class="flex flex-col gap-0.5 leading-none">
								<span class="font-medium">{displayTitle}</span>
								<span class="">{displayVersion}</span>
							</div>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>

		<SearchForm bind:value={query} />
	</Sidebar.Header>

	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.Menu>
				{#each navMain as item, index (item.title)}
					<Collapsible.Root open={item.isOpen || index === 0} class="group/collapsible">
						<Sidebar.MenuItem>
							<Collapsible.Trigger>
								{#snippet child({ props })}
									<Sidebar.MenuButton {...props}>
										{item.title}
										<PlusIcon class="ms-auto group-data-[state=open]/collapsible:hidden" />
										<MinusIcon class="ms-auto group-data-[state=closed]/collapsible:hidden" />
									</Sidebar.MenuButton>
								{/snippet}
							</Collapsible.Trigger>

							{#if item.items?.length}
								<Collapsible.Content>
									<Sidebar.MenuSub>
										{#each item.items as subItem (subItem.url)}
											<Sidebar.MenuSubItem>
												<Sidebar.MenuSubButton isActive={subItem.isActive}>
													{#snippet child({ props })}
														<a
															{...props}
															href={subItem.url}
															class="flex justify-between py-0.5 text-sm"
														>
															{subItem.title}
															<Badge variant="outline" class={methodClass(subItem.method)}
																>{subItem.method}</Badge
															>
														</a>
													{/snippet}

													{#if subItem.method}
														<Sidebar.MenuBadge class={methodClass(subItem.method)}>
															{subItem.method}
														</Sidebar.MenuBadge>
													{/if}
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
