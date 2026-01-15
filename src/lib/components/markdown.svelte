<script>
	import { renderMarkdown } from '$lib/utils/markdown.js';

	let { content = '', linkResolver = null } = $props();
	const html = $derived(renderMarkdown(content, { transformLink: linkResolver }));
</script>

{#if content}
	<div class="markdown">{@html html}</div>
{/if}
