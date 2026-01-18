import { browser } from '$app/environment';
import { derived, get, writable } from 'svelte/store';
import { loadOpenApi } from '$lib/api/openapi.js';

// todo: remove the proxy logic, just use it as a spa

const DEFAULT_SOURCE = {
	id: 'default',
	name: 'Default API',
	url: '/openapi.json',
	isDefault: true,
	useProxy: false
};

const STORAGE_KEY = 'jevido.openapi.sources';
const ACTIVE_KEY = 'jevido.openapi.active';
const DEFAULT_HIDDEN_KEY = 'jevido.openapi.default_hidden';

const sources = writable([DEFAULT_SOURCE]);
const activeId = writable(DEFAULT_SOURCE.id);
const specs = writable(null);
const status = writable({ state: 'idle', error: null });

let initialized = false;

function safeParse(value) {
	if (!value) return null;
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

function normalizeSource(raw) {
	if (!raw || typeof raw !== 'object') return null;
	const name = typeof raw.name === 'string' ? raw.name.trim() : '';
	const url = typeof raw.url === 'string' ? raw.url.trim() : '';
	const id = typeof raw.id === 'string' ? raw.id.trim() : '';
	const useProxy = Boolean(raw.useProxy);
	if (!id || !url) return null;
	return {
		id,
		name: name || url,
		url,
		isDefault: Boolean(raw.isDefault),
		useProxy
	};
}

function normalizeSources(list, includeDefault = true) {
	const next = [];
	const seen = new Set();
	const items = Array.isArray(list) ? list : [];
	let defaultSource = DEFAULT_SOURCE;
	for (const item of items) {
		const normalized = normalizeSource(item);
		if (!normalized || seen.has(normalized.id)) continue;
		if (normalized.id === DEFAULT_SOURCE.id) {
			defaultSource = { ...DEFAULT_SOURCE, ...normalized };
			continue;
		}
		seen.add(normalized.id);
		next.push(normalized);
	}
	if (!includeDefault) return next;
	return [defaultSource, ...next];
}

function persistSources(list) {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function persistActive(id) {
	if (!browser) return;
	localStorage.setItem(ACTIVE_KEY, id);
}

function resolveActiveSource(list, id) {
	if (!list.length) return null;
	return list.find((source) => source.id === id) || list[0];
}

async function refreshSpecs() {
	const list = get(sources);
	const id = get(activeId);
	const active = resolveActiveSource(list, id);
	if (!active) {
		specs.set(null);
		status.set({ state: 'idle', error: null });
		return;
	}
	if (active.id !== id) {
		activeId.set(active.id);
		persistActive(active.id);
	}
	status.set({ state: 'loading', error: null });
	try {
		const next = await loadOpenApi(active.url);
		specs.set(next);
		status.set({ state: 'ready', error: null });
		const specName = next?.info?.title?.trim();
		if (specName && active.name !== specName) {
			const updated = list.map((source) =>
				source.id === active.id ? { ...source, name: specName } : source
			);
			sources.set(updated);
			persistSources(updated);
		}
	} catch (error) {
		specs.set(null);
		status.set({ state: 'error', error });
	}
}

function createId(name, url) {
	const base = (name || url || 'spec')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)+/g, '');
	const suffix = Math.random().toString(36).slice(2, 7);
	return `${base || 'spec'}-${suffix}`;
}

export async function initOpenApi() {
	if (!browser || initialized) return;
	initialized = true;
	const defaultHidden = localStorage.getItem(DEFAULT_HIDDEN_KEY) === '1';
	const stored = normalizeSources(safeParse(localStorage.getItem(STORAGE_KEY)), !defaultHidden);
	sources.set(stored);
	const storedActive = localStorage.getItem(ACTIVE_KEY);
	const active = resolveActiveSource(stored, storedActive);
	if (!active) {
		activeId.set('');
		specs.set(null);
		status.set({ state: 'idle', error: null });
		return;
	}
	activeId.set(active.id);
	await refreshSpecs();
}

export async function setActiveOpenApiSource(id) {
	activeId.set(id);
	persistActive(id);
	await refreshSpecs();
}

export async function addOpenApiSource({ name, url, useProxy = false }) {
	const trimmedUrl = typeof url === 'string' ? url.trim() : '';
	if (!trimmedUrl) {
		return { ok: false, error: new Error('Missing OpenAPI URL.') };
	}
	const trimmedName = typeof name === 'string' ? name.trim() : '';
	const defaultHidden = browser ? localStorage.getItem(DEFAULT_HIDDEN_KEY) === '1' : false;
	const previousSpecs = get(specs);
	const previousStatus = get(status);
	status.set({ state: 'loading', error: null });
	try {
		const nextSpec = await loadOpenApi(trimmedUrl);
		const specName = nextSpec?.info?.title?.trim();
		const sourceName = specName || trimmedName || trimmedUrl;
		const newSource = {
			id: createId(sourceName, trimmedUrl),
			name: sourceName,
			url: trimmedUrl,
			isDefault: false,
			useProxy: Boolean(useProxy)
		};
		const list = normalizeSources([...get(sources), newSource], !defaultHidden);
		sources.set(list);
		persistSources(list);
		activeId.set(newSource.id);
		persistActive(newSource.id);
		specs.set(nextSpec);
		status.set({ state: 'ready', error: null });
		return { ok: true };
	} catch (error) {
		specs.set(previousSpecs);
		status.set(previousStatus);
		return { ok: false, error };
	}
}

export async function removeOpenApiSource(id) {
	const list = get(sources);
	if (!list.find((source) => source.id === id)) return;

	if (browser && id === DEFAULT_SOURCE.id) {
		localStorage.setItem(DEFAULT_HIDDEN_KEY, '1');
	}

	const defaultHidden = browser ? localStorage.getItem(DEFAULT_HIDDEN_KEY) === '1' : false;
	const nextList = normalizeSources(
		list.filter((source) => source.id !== id),
		!defaultHidden
	);
	sources.set(nextList);
	persistSources(nextList);

	if (get(activeId) !== id) return;
	const nextActive = resolveActiveSource(nextList, '');
	if (!nextActive) {
		activeId.set('');
		persistActive('');
		specs.set(null);
		status.set({ state: 'idle', error: null });
		return;
	}
	activeId.set(nextActive.id);
	persistActive(nextActive.id);
	await refreshSpecs();
}

export function setOpenApiSourceProxy(id, useProxy) {
	const list = get(sources);
	let changed = false;
	const nextList = list.map((source) => {
		if (source.id !== id) return source;
		const nextUseProxy = Boolean(useProxy);
		if (source.useProxy === nextUseProxy) return source;
		changed = true;
		return { ...source, useProxy: nextUseProxy };
	});
	if (!changed) return;
	sources.set(nextList);
	persistSources(nextList);
}

export const openapiSources = {
	subscribe: sources.subscribe
};

export const openapiSpecs = {
	subscribe: specs.subscribe
};

export const openapiStatus = {
	subscribe: status.subscribe
};

export const activeOpenApiSource = derived([sources, activeId], ([$sources, $activeId]) =>
	resolveActiveSource($sources, $activeId)
);
