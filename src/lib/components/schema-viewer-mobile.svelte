<script>
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Accordion from '$lib/components/ui/accordion/index.js';
	import Recursive from './schema-viewer-mobile.svelte';

	let { schema } = $props();

	function resolveType(schema) {
		if (!schema) return '—';
		if (schema.type) return schema.type;
		if (schema.enum) return 'enum';
		if (schema.oneOf) return 'oneOf';
		if (schema.anyOf) return 'anyOf';
		if (schema.allOf) return 'allOf';
		return 'object';
	}

	function isPrimitive(type) {
		return ['string', 'number', 'integer', 'boolean'].includes(type);
	}
</script>

{#if !schema}
	<div class="text-sm text-muted-foreground">No schema</div>
{:else}
	<div class="space-y-3">
		{#if schema.description}
			<div class="text-sm text-muted-foreground">{schema.description}</div>
		{/if}

		{#if schema.examples?.length}
			<div class="flex flex-wrap gap-2">
				{#each schema.examples as example}
					<Badge variant="outline">
						{typeof example === 'string' ? example : JSON.stringify(example)}
					</Badge>
				{/each}
			</div>
		{/if}

		{#if schema.example != null}
			<div class="text-xs text-muted-foreground">
				example: {JSON.stringify(schema.example)}
			</div>
		{/if}

		<!-- ENUM -->
		{#if schema.enum}
			<div class="flex flex-wrap gap-2">
				{#each schema.enum as value}
					<Badge variant="outline">{value}</Badge>
				{/each}
			</div>
		{/if}

		<!-- ONE OF / ANY OF / ALL OF -->
		{#if schema.oneOf || schema.anyOf || schema.allOf}
			<Accordion.Root type="multiple" class="space-y-2">
				{#each schema.oneOf || schema.anyOf || schema.allOf as subSchema, i}
					<Accordion.Item value={`item-${i}`} class="rounded-lg border p-3">
						<Accordion.Trigger class="py-2 text-xs font-medium">
							{schema.oneOf ? 'One of' : schema.anyOf ? 'Any of' : 'All of'} #{i + 1}
						</Accordion.Trigger>
						<Accordion.Content class="pt-3">
							<Recursive schema={subSchema} />
						</Accordion.Content>
					</Accordion.Item>
				{/each}
			</Accordion.Root>
		{/if}

		<!-- OBJECT -->
		{#if schema.type === 'object' && schema.properties}
			<Accordion.Root type="multiple" class="space-y-2">
				{#each Object.entries(schema.properties) as [key, value]}
					<Accordion.Item value={key} class="rounded-lg border p-3">
						<Accordion.Trigger class="py-2 font-mono text-sm">
							<div class="flex items-center justify-between gap-2 text-left">
								<span>{key}</span>
								<span class="text-xs text-muted-foreground">
									{resolveType(value)}
									{#if schema.required?.includes(key)}
										<span class="ms-1 text-rose-400">*</span>
									{/if}
								</span>
							</div>
						</Accordion.Trigger>
						<Accordion.Content class="space-y-2 pt-3">
							{#if value.description}
								<div class="text-sm text-muted-foreground">{value.description}</div>
							{/if}

							{#if value.format}
								<div class="text-xs text-muted-foreground">format: {value.format}</div>
							{/if}

							{#if value.example}
								<div class="text-xs text-muted-foreground">
									example: {JSON.stringify(value.example)}
								</div>
							{/if}

							{#if value.examples?.length}
								<div class="flex flex-wrap gap-2">
									{#each value.examples as example}
										<Badge variant="outline">
											{typeof example === 'string' ? example : JSON.stringify(example)}
										</Badge>
									{/each}
								</div>
							{/if}

							{#if value.type === 'object' || value.type === 'array' || value.oneOf || value.anyOf || value.allOf}
								<Recursive schema={value} />
							{:else if isPrimitive(value.type)}
								<div class="text-xs text-muted-foreground">{value.type}</div>
							{/if}
						</Accordion.Content>
					</Accordion.Item>
				{/each}
			</Accordion.Root>
		{/if}

		<!-- ARRAY -->
		{#if schema.type === 'array'}
			<div class="space-y-2 rounded-lg border p-3">
				<div class="text-xs text-muted-foreground">Array of</div>
				<Recursive schema={schema.items} />
			</div>
		{/if}

		<!-- PRIMITIVE -->
		{#if isPrimitive(schema.type)}
			<div class="text-sm text-muted-foreground">{schema.format || schema.type}</div>
		{/if}
	</div>
{/if}
