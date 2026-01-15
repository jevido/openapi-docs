import MarkdownIt from 'markdown-it';

const alertTypes = ['note', 'tip', 'important', 'warning', 'caution'];
const alertPattern = new RegExp(
	`<blockquote>\\s*<p>\\[!(${alertTypes.join('|')})\\]\\s*`,
	'gi'
);

const markdown = new MarkdownIt({
	html: true,
	linkify: true,
	breaks: true
});

export function renderMarkdown(value) {
	if (!value) return '';
	const html = markdown.render(value);
	return html.replace(alertPattern, (_match, type) => {
		const label = type.charAt(0).toUpperCase() + type.slice(1);
		return `<blockquote class="markdown-alert markdown-alert-${type}"><p class="markdown-alert-title">${label}</p><p>`;
	});
}
