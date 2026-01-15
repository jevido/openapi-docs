import MarkdownIt from 'markdown-it';

const alertTypes = ['note', 'tip', 'important', 'warning', 'caution'];
const alertPattern = new RegExp(`<blockquote>\\s*<p>\\[!(${alertTypes.join('|')})\\]\\s*`, 'gi');

const markdown = new MarkdownIt({
	html: true,
	linkify: true,
	breaks: true
});

function createMarkdown(transformLink) {
	if (!transformLink) return markdown;

	const instance = new MarkdownIt({
		html: true,
		linkify: true,
		breaks: true
	});

	const defaultRender =
		instance.renderer.rules.link_open ||
		((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options));

	instance.renderer.rules.link_open = (tokens, idx, options, env, self) => {
		const hrefIndex = tokens[idx].attrIndex('href');
		if (hrefIndex >= 0) {
			const href = tokens[idx].attrs[hrefIndex][1];
			const nextHref = transformLink(href);
			if (nextHref) {
				tokens[idx].attrs[hrefIndex][1] = nextHref;
			}
		}
		return defaultRender(tokens, idx, options, env, self);
	};

	return instance;
}

export function renderMarkdown(value, { transformLink } = {}) {
	if (!value) return '';
	const instance = createMarkdown(transformLink);
	const html = instance.render(value);
	return html.replace(alertPattern, (_match, type) => {
		const label = type.charAt(0).toUpperCase() + type.slice(1);
		return `<blockquote class="markdown-alert markdown-alert-${type}"><p class="markdown-alert-title">${label}</p><p>`;
	});
}
