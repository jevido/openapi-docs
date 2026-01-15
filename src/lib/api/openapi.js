// openapi.js
// Utility helpers for reading and normalizing OpenAPI 3.x specs
// Designed for building custom docs UIs (Svelte + shadcn friendly)

/* ================================
   Loader
================================ */

export async function loadOpenApi(url) {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to load OpenAPI: ${res.status}`);
	}
	return res.json();
}

/* ================================
   Tags
================================ */

export function getTags(openapi) {
	return (
		openapi.tags?.map((tag) => ({
			name: tag.name,
			description: tag.description || ''
		})) || []
	);
}

/* ================================
   Endpoints grouped by tag
================================ */

export function getEndpointsByTag(openapi) {
	const result = {};

	for (const [path, methods] of Object.entries(openapi.paths || {})) {
		for (const [method, operation] of Object.entries(methods)) {
			const tags = operation.tags || ['Untagged'];

			for (const tag of tags) {
				if (!result[tag]) result[tag] = [];

				result[tag].push({
					path,
					method: method.toUpperCase(),
					summary: operation.summary || '',
					description: operation.description || '',
					operationId: operation.operationId || null
				});
			}
		}
	}

	return result;
}

/* ================================
   Single operation
================================ */

export function getOperation(openapi, path, method) {
	const pathItem = openapi.paths?.[path];
	const op = pathItem?.[method.toLowerCase()];
	if (!op) return null;

	const parameters = [...(pathItem?.parameters || []), ...(op.parameters || [])];

	return {
		path,
		method: method.toUpperCase(),
		summary: op.summary || '',
		description: op.description || '',
		operationId: op.operationId || null,
		deprecated: op.deprecated || false,
		extensions: Object.fromEntries(Object.entries(op).filter(([key]) => key.startsWith('x-'))),
		externalDocs: op.externalDocs || null,
		parameters,
		requestBody: op.requestBody || null,
		responses: op.responses || {},
		tags: op.tags || [],
		servers: op.servers || pathItem?.servers || openapi.servers || [],
		security: op.security ?? null
	};
}

/* ================================
   Server helpers
================================ */

function resolveServerUrl(server) {
	if (!server?.url) return '';

	let url = server.url;
	const variables = server.variables || {};

	for (const [name, config] of Object.entries(variables)) {
		const value = config?.default ?? config?.enum?.[0];
		if (value != null) {
			url = url.replace(`{${name}}`, value);
		}
	}

	return url;
}

export function getServerUrl(openapi, path, method) {
	const op = openapi.paths?.[path]?.[method.toLowerCase()];
	const pathItem = openapi.paths?.[path];
	const server = op?.servers?.[0] || pathItem?.servers?.[0] || openapi.servers?.[0];

	return resolveServerUrl(server);
}

export function getServers(openapi, path, method) {
	const op = openapi.paths?.[path]?.[method.toLowerCase()];
	const pathItem = openapi.paths?.[path];
	const servers = op?.servers || pathItem?.servers || openapi.servers || [];

	return servers.map((server) => ({
		url: server.url || '',
		description: server.description || '',
		resolvedUrl: resolveServerUrl(server)
	}));
}

export function getSecurityRequirements(openapi, operation) {
	const operationSecurity = operation.security ?? null;
	const security = operationSecurity ?? openapi.security;
	if (!security) return [];

	if (security.length === 0) {
		return [{ schemes: [] }];
	}

	return security.map((requirement) => ({
		schemes: Object.entries(requirement).map(([name, scopes]) => ({
			name,
			scopes: scopes || [],
			scheme: openapi.components?.securitySchemes?.[name] || null
		}))
	}));
}

export function getTag(openapi, name) {
	if (!name) return null;
	return openapi.tags?.find((tag) => tag.name === name) || null;
}

export function schemaToExample(schema) {
	if (!schema) return null;

	if (schema.examples?.length) return schema.examples[0];
	if (schema.example != null) return schema.example;
	if (schema.default != null) return schema.default;
	if (schema.enum?.length) return schema.enum[0];

	if (schema.oneOf?.length) return schemaToExample(schema.oneOf[0]);
	if (schema.anyOf?.length) return schemaToExample(schema.anyOf[0]);
	if (schema.allOf?.length) return schemaToExample(schema.allOf[0]);

	if (schema.type === 'object') {
		const obj = {};
		for (const [key, value] of Object.entries(schema.properties || {})) {
			obj[key] = schemaToExample(value);
		}
		return obj;
	}

	if (schema.type === 'array') {
		const itemExample = schemaToExample(schema.items);
		return itemExample == null ? [] : [itemExample];
	}

	if (schema.type === 'boolean') return false;
	if (schema.type === 'integer' || schema.type === 'number') return 0;
	if (schema.type === 'string') return 'string';

	return null;
}

/* ================================
   $ref resolver
================================ */

export function resolveRef(openapi, ref) {
	if (!ref || typeof ref !== 'string') return null;
	if (!ref.startsWith('#/')) return null;

	const parts = ref.replace('#/', '').split('/');
	let current = openapi;

	for (const part of parts) {
		current = current?.[part];
		if (!current) return null;
	}

	return current;
}

function resolveSchema(openapi, schema) {
	if (!schema) return null;
	if (schema.$ref) return resolveRef(openapi, schema.$ref);
	return schema;
}

function normalizeExamples(examples, example) {
	if (examples && typeof examples === 'object') {
		return Object.entries(examples).map(([name, value]) => ({
			name,
			summary: value?.summary ?? '',
			description: value?.description ?? '',
			value: value?.value ?? null,
			externalValue: value?.externalValue ?? ''
		}));
	}

	if (example != null) {
		return [
			{
				name: 'Example',
				summary: '',
				description: '',
				value: example,
				externalValue: ''
			}
		];
	}

	return [];
}

function normalizeContent(openapi, content) {
	if (!content) return [];

	return Object.entries(content).map(([mediaType, value]) => {
		const schema = value?.schema
			? expandSchema(openapi, resolveSchema(openapi, value.schema))
			: null;
		const examples = normalizeExamples(value?.examples, value?.example);

		return {
			mediaType,
			schema,
			examples
		};
	});
}

function normalizeHeaders(openapi, headers) {
	if (!headers) return [];

	return Object.entries(headers)
		.map(([name, header]) => {
			const resolvedHeader = header?.$ref ? resolveRef(openapi, header.$ref) : header;
			if (!resolvedHeader) return null;

			const headerSchema = resolveSchema(openapi, resolvedHeader.schema);
			const schema = headerSchema ? expandSchema(openapi, headerSchema) : null;

			return {
				name,
				description: resolvedHeader.description || '',
				required: resolvedHeader.required || false,
				deprecated: resolvedHeader.deprecated || false,
				schema,
				example: resolvedHeader.example ?? null,
				examples: normalizeExamples(resolvedHeader.examples, resolvedHeader.example)
			};
		})
		.filter(Boolean);
}

function resolveResponse(openapi, response) {
	return response?.$ref ? resolveRef(openapi, response.$ref) : response;
}

/* ================================
   Schema helpers
================================ */

export function getSchema(openapi, name) {
	return openapi.components?.schemas?.[name] || null;
}

export function expandSchema(openapi, schema) {
	if (!schema) return null;

	// Resolve $ref
	if (schema.$ref) {
		const resolved = resolveRef(openapi, schema.$ref);
		return expandSchema(openapi, resolved);
	}

	// Object
	if (schema.type === 'object' && schema.properties) {
		const properties = {};

		for (const [key, value] of Object.entries(schema.properties)) {
			properties[key] = expandSchema(openapi, value);
		}

		return {
			...schema,
			properties
		};
	}

	if (schema.oneOf?.length) {
		return {
			...schema,
			oneOf: schema.oneOf.map((item) => expandSchema(openapi, item))
		};
	}

	if (schema.anyOf?.length) {
		return {
			...schema,
			anyOf: schema.anyOf.map((item) => expandSchema(openapi, item))
		};
	}

	if (schema.allOf?.length) {
		return {
			...schema,
			allOf: schema.allOf.map((item) => expandSchema(openapi, item))
		};
	}

	// Array
	if (schema.type === 'array' && schema.items) {
		return {
			...schema,
			items: expandSchema(openapi, schema.items)
		};
	}

	return schema;
}

/* ================================
   Parameters
================================ */

export function getParameters(openapi, operation) {
	return (operation.parameters || [])
		.map((param) => {
			const resolvedParam = param?.$ref ? resolveRef(openapi, param.$ref) : param;
			if (!resolvedParam) return null;

			let schema = resolvedParam.schema;

			if (schema?.$ref) {
				schema = resolveRef(openapi, schema.$ref);
			}

			const example = resolvedParam.example ?? schema?.example ?? null;
			let examples = normalizeExamples(resolvedParam.examples, example);
			if (!examples.length && Array.isArray(schema?.examples)) {
				examples = schema.examples.map((value, index) => ({
					name: `Example ${index + 1}`,
					summary: '',
					description: '',
					value,
					externalValue: ''
				}));
			}

			return {
				name: resolvedParam.name,
				in: resolvedParam.in,
				required: resolvedParam.required || false,
				description: resolvedParam.description || '',
				schema,
				example,
				examples
			};
		})
		.filter((param) => param?.name && param?.in);
}

/* ================================
   Request body
================================ */

export function getRequestBodySchema(openapi, operation) {
	let requestBody = operation.requestBody;
	if (requestBody?.$ref) {
		requestBody = resolveRef(openapi, requestBody.$ref);
	}

	const content = requestBody?.content;
	if (!content) return null;

	const json = content['application/json'];
	if (!json?.schema) return null;

	return expandSchema(openapi, json.schema);
}

export function getRequestBody(openapi, operation) {
	let requestBody = operation.requestBody;
	if (!requestBody) return null;

	if (requestBody.$ref) {
		requestBody = resolveRef(openapi, requestBody.$ref);
	}

	if (!requestBody) return null;

	return {
		description: requestBody.description || '',
		required: requestBody.required || false,
		content: normalizeContent(openapi, requestBody.content)
	};
}

/* ================================
   Responses
================================ */

export function getResponseSchemas(openapi, operation) {
	const result = {};

	for (const [status, response] of Object.entries(operation.responses || {})) {
		const resolved = resolveResponse(openapi, response);
		const content = resolved?.content;
		if (!content) continue;

		const json = content['application/json'];
		if (json?.schema) {
			result[status] = expandSchema(openapi, json.schema);
			continue;
		}

		const first = Object.values(content).find((entry) => entry?.schema);
		if (first?.schema) {
			result[status] = expandSchema(openapi, first.schema);
		}
	}

	return result;
}

export function getResponses(openapi, operation) {
	const result = {};

	for (const [status, response] of Object.entries(operation.responses || {})) {
		const resolved = resolveResponse(openapi, response);
		if (!resolved) continue;

		result[status] = {
			description: resolved.description || '',
			headers: normalizeHeaders(openapi, resolved.headers),
			content: normalizeContent(openapi, resolved.content)
		};
	}

	return result;
}

/* ================================
   High-level doc builder
================================ */

export function getEndpointDoc(openapi, path, method) {
	const operation = getOperation(openapi, path, method);
	if (!operation) return null;

	return {
		...operation,
		parameters: getParameters(openapi, operation),
		requestBodySchema: getRequestBodySchema(openapi, operation),
		requestBody: getRequestBody(openapi, operation),
		responses: getResponses(openapi, operation),
		servers: getServers(openapi, path, method),
		securityRequirements: getSecurityRequirements(openapi, operation),
		responseSchemas: getResponseSchemas(openapi, operation)
	};
}

/* ================================
   Convenience helpers
================================ */

export function getAllEndpoints(openapi) {
	const result = [];

	for (const [path, methods] of Object.entries(openapi.paths || {})) {
		for (const [method, operation] of Object.entries(methods)) {
			result.push({
				path,
				method: method.toUpperCase(),
				summary: operation.summary || '',
				tags: operation.tags || []
			});
		}
	}

	return result;
}

export function getSchemas(openapi) {
	return openapi.components?.schemas || {};
}

export const specs = await loadOpenApi('/openapi.json');
