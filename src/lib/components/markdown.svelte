<script>
	import { renderMarkdown } from '$lib/utils/markdown.js';

	let { content = '' } = $props();
	const html = $derived(renderMarkdown(content));
</script>

{#if content}
	<div class="markdown">{@html html}</div>
{/if}
