const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

const METHOD_ORDER = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];

export function getSpecMeta(spec) {
	const info = spec?.info ?? {};
	return {
		title: info.title ?? 'API Reference',
		version: info.version ?? 'unversioned',
		description: info.description ?? ''
	};
}

export function getBaseUrl(spec, specUrl) {
	const serverUrl = spec?.servers?.[0]?.url;
	if (serverUrl) {
		if (serverUrl.startsWith('http://') || serverUrl.startsWith('https://')) {
			return serverUrl.replace(/\/$/, '');
		}

		if (specUrl) {
			try {
				const origin = new URL(specUrl).origin;
				return `${origin}${serverUrl.startsWith('/') ? '' : '/'}${serverUrl}`.replace(/\/$/, '');
			} catch {
				return serverUrl.replace(/\/$/, '');
			}
		}

		return serverUrl.replace(/\/$/, '');
	}

	if (specUrl) {
		try {
			return new URL(specUrl).origin;
		} catch {
			return '';
		}
	}

	return '';
}

export function getOperations(spec) {
	const paths = spec?.paths ?? {};
	const operations = [];

	for (const [path, pathItem] of Object.entries(paths)) {
		if (!pathItem || typeof pathItem !== 'object') continue;

		const sharedParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];

		for (const [method, operation] of Object.entries(pathItem)) {
			if (!HTTP_METHODS.has(method)) continue;
			if (!operation || typeof operation !== 'object') continue;

			const params = Array.isArray(operation.parameters) ? operation.parameters : [];
			const operationId = toOperationId(method, path, operation);
			const tags =
				Array.isArray(operation.tags) && operation.tags.length ? operation.tags : ['default'];

			operations.push({
				id: operationId,
				method,
				path,
				summary: operation.summary ?? operationId,
				description: operation.description ?? '',
				operationId,
				tags,
				deprecated: Boolean(operation.deprecated),
				parameters: [...sharedParams, ...params],
				requestBody: operation.requestBody ?? null,
				responses: operation.responses ?? {}
			});
		}
	}

	return operations.sort((a, b) => {
		if (a.path !== b.path) return a.path.localeCompare(b.path);
		return METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method);
	});
}

export function getSchemas(spec) {
	const schemas = spec?.components?.schemas ?? {};
	return Object.entries(schemas).map(([name, schema]) => ({ name, schema }));
}

export function toOperationId(method, path, operation) {
	if (operation?.operationId) return operation.operationId;
	const normalizedPath = path
		.replace(/[{}]/g, '')
		.split('/')
		.filter(Boolean)
		.map((segment) => segment.replace(/[^a-zA-Z0-9]+/g, '-'))
		.filter(Boolean)
		.join('-');
	return `${method}-${normalizedPath || 'root'}`;
}
