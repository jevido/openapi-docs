<script>
	import * as Card from '$lib/components/ui/card/index.js';
</script>

<Card.Root class="border-destructive/40">
	<Card.Header>
		<Card.Title>Unable to load the API spec</Card.Title>
		<Card.Description>todo description</Card.Description>
	</Card.Header>
	<Card.Content>
		<p class="text-sm text-muted-foreground">
			Set OPENAPI_LOCATION in your environment to the OpenAPI JSON endpoint.
		</p>
	</Card.Content>
</Card.Root>
