<script>
	import { page } from '$app/state';
	import SearchForm from './search-form.svelte';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { getEndpointsByTag, specs } from '$lib/api/openapi.js';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';

	import GalleryVerticalEndIcon from '@lucide/svelte/icons/gallery-vertical-end';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';

	let { ref = $bindable(null), ...restProps } = $props();

	const pathname = $derived(page.url.pathname);
	let query = $state('');

	const endpointsByTag = $derived(specs ? getEndpointsByTag(specs) : {});

	const displayTitle = $derived(specs?.info?.title ?? 'Documentation');
	const displayVersion = $derived(specs?.info?.version ? `v${specs.info.version}` : 'v1.0.0');

	/* =========================
	   Filtered nav grouped per tag
	========================= */
	const navMain = $derived.by(() => {
		if (!specs) return [];

		const result = [];

		for (const [tag, endpoints] of Object.entries(endpointsByTag)) {
			const filtered = endpoints.filter((op) => {
				if (!query.trim()) return true;
				return op.path.includes(query) || op.summary.includes(query) || op.method.includes(needle);
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
				<Sidebar.MenuButton size="lg" class="text-[13px]">
					{#snippet child({ props })}
						<a href="/" {...props}>
							<div
								class="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"
							>
								<GalleryVerticalEndIcon class="size-4" />
							</div>
							<div class="flex flex-col gap-0.5 leading-none">
								<span class="font-medium">{displayTitle}</span>
								<span>{displayVersion}</span>
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
															class="h-auto w-full py-0 px-1 items-start justify-between gap-2 whitespace-normal text-[13px] leading-snug text-left"
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
