<script>
	import { Badge } from '$lib/components/ui/badge/index.js';
	import Recursive from '../components/schema-viewer.svelte';

	let { schema } = $props();

	// Import self recursively under a different name

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
			{#each schema.oneOf || schema.anyOf || schema.allOf as subSchema, i}
				<div class="rounded-lg border p-3">
					<div class="mb-2 text-xs text-muted-foreground">
						{schema.oneOf ? 'One of' : schema.anyOf ? 'Any of' : 'All of'} #{i + 1}
					</div>
					<Recursive schema={subSchema} />
				</div>
			{/each}
		{/if}

		<!-- OBJECT -->
		{#if schema.type === 'object' && schema.properties}
			<div class="divide-y rounded-lg border">
				{#each Object.entries(schema.properties) as [key, value]}
					<div class="flex items-start gap-4 p-3">
						<div class="w-48 shrink-0">
							<div class="font-mono text-sm">{key}</div>
							<div class="text-xs text-muted-foreground">
								{resolveType(value)}
								{#if schema.required?.includes(key)}
									<span class="ms-1 text-rose-400">*</span>
								{/if}
							</div>
						</div>

						<div class="flex-1 space-y-1">
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

							{#if value.type === 'object' || value.type === 'array' || value.oneOf || value.anyOf || value.allOf}
								<Recursive schema={value} />
							{:else if isPrimitive(value.type)}
								<div class="text-xs text-muted-foreground">{value.type}</div>
							{/if}
						</div>
					</div>
				{/each}
			</div>
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
