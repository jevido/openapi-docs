function getTargetUrl(url) {
	const target = url.searchParams.get('url');
	if (!target) {
		return { error: 'Missing url query parameter.' };
	}
	let parsed;
	try {
		parsed = new URL(target);
	} catch {
		return { error: 'Invalid url query parameter.' };
	}
	if (!['http:', 'https:'].includes(parsed.protocol)) {
		return { error: 'Only http and https targets are supported.' };
	}
	return { target: parsed.toString() };
}

async function handleProxy({ request, url, fetch }) {
	const result = getTargetUrl(url);
	if (result.error) {
		return new Response(result.error, { status: 400 });
	}

	const method = request.method;
	const body = ['GET', 'HEAD'].includes(method) ? undefined : request.body;
	const proxiedRequest = new Request(result.target, {
		method,
		headers: request.headers,
		body,
		redirect: 'follow',
		duplex: body ? 'half' : undefined
	});
	const response = await fetch(proxiedRequest);

	console.debug('Were here boys', url);
	console.log('Proxy request', { target: result.target, method });

	return response;
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const OPTIONS = handleProxy;
export const HEAD = handleProxy;
