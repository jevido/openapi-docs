import { env } from '$env/dynamic/private';

export async function load({ fetch }) {
	const specUrl = env.OPENAPI_LOCATION;

	if (!specUrl) {
		return {
			spec: null,
			specUrl: null,
			error: 'OPENAPI_LOCATION is not set.'
		};
	}

	try {
		const response = await fetch(specUrl, { cache: 'no-store' });
		if (!response.ok) {
			return {
				spec: null,
				specUrl,
				error: `Failed to load OpenAPI spec (${response.status}).`
			};
		}

		const spec = await response.json();
		return {
			spec,
			specUrl,
			error: null
		};
	} catch {
		return {
			spec: null,
			specUrl,
			error: 'Unable to reach the OpenAPI spec endpoint.'
		};
	}
}
