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
	const op = openapi.paths?.[path]?.[method.toLowerCase()];
	if (!op) return null;

	return {
		path,
		method: method.toUpperCase(),
		summary: op.summary || '',
		description: op.description || '',
		parameters: op.parameters || [],
		requestBody: op.requestBody || null,
		responses: op.responses || {},
		tags: op.tags || []
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

export function schemaToExample(schema) {
	if (!schema) return null;

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
	return (operation.parameters || []).map((param) => {
		let schema = param.schema;

		if (schema?.$ref) {
			schema = resolveRef(openapi, schema.$ref);
		}

		return {
			name: param.name,
			in: param.in,
			required: param.required || false,
			description: param.description || '',
			schema
		};
	});
}

/* ================================
   Request body
================================ */

export function getRequestBodySchema(openapi, operation) {
	const content = operation.requestBody?.content;
	if (!content) return null;

	const json = content['application/json'];
	if (!json?.schema) return null;

	return expandSchema(openapi, json.schema);
}

/* ================================
   Responses
================================ */

export function getResponseSchemas(openapi, operation) {
	const result = {};

	for (const [status, response] of Object.entries(operation.responses || {})) {
		const content = response.content?.['application/json'];
		if (!content?.schema) continue;

		result[status] = expandSchema(openapi, content.schema);
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
