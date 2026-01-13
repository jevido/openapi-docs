import { getBaseUrl, getOperations } from './openapi.js';

function buildUrl(baseUrl, path, pathParams = {}, query = {}) {
	const normalizedBase = baseUrl ? baseUrl.replace(/\/$/, '') : '';
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	let url = `${normalizedBase}${normalizedPath}`;

	for (const [key, value] of Object.entries(pathParams)) {
		url = url.replaceAll(`{${key}}`, encodeURIComponent(String(value)));
	}

	const urlObject =
		url.startsWith('http://') || url.startsWith('https://')
			? new URL(url)
			: new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');

	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === null) continue;
		if (Array.isArray(value)) {
			for (const item of value) {
				urlObject.searchParams.append(key, String(item));
			}
		} else {
			urlObject.searchParams.set(key, String(value));
		}
	}

	return urlObject.toString();
}

async function handleResponse(response) {
	const contentType = response.headers.get('content-type') || '';
	const isJson = contentType.includes('application/json');
	const payload = isJson ? await response.json() : await response.text();

	if (!response.ok) {
		const error = new Error(`Request failed with status ${response.status}`);
		error.status = response.status;
		error.payload = payload;
		throw error;
	}

	return payload;
}

export function createOpenApiClient(spec, options = {}) {
	const operations = getOperations(spec);
	const baseUrl = options.baseUrl ?? getBaseUrl(spec, options.specUrl);
	const fetchImpl = options.fetch ?? fetch;

	const byId = Object.create(null);

	for (const operation of operations) {
		byId[operation.operationId] = async ({ pathParams, query, body, headers } = {}) => {
			const url = buildUrl(baseUrl, operation.path, pathParams, query);
			const init = {
				method: operation.method.toUpperCase(),
				headers: {
					...(body !== undefined ? { 'content-type': 'application/json' } : {}),
					...headers
				},
				body: body !== undefined ? JSON.stringify(body) : undefined
			};

			const response = await fetchImpl(url, init);
			return handleResponse(response);
		};
	}

	return {
		baseUrl,
		operations,
		request: async ({ method, path, pathParams, query, body, headers }) => {
			const url = buildUrl(baseUrl, path, pathParams, query);
			const response = await fetchImpl(url, {
				method: method.toUpperCase(),
				headers: {
					...(body !== undefined ? { 'content-type': 'application/json' } : {}),
					...headers
				},
				body: body !== undefined ? JSON.stringify(body) : undefined
			});
			return handleResponse(response);
		},
		byId
	};
}
