import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const ALLOWED_HOSTS = new Set([
	'maps.app.goo.gl',
	'goo.gl',
	'google.com',
	'www.google.com',
	'maps.google.com'
]);

function isAllowedGoogleMapsHost(hostname: string): boolean {
	if (ALLOWED_HOSTS.has(hostname)) {
		return true;
	}

	return hostname.endsWith('.google.com');
}

function toSafeUrl(raw: string): URL | null {
	const candidate = raw.trim();
	if (!candidate) {
		return null;
	}

	try {
		return new URL(candidate);
	} catch {
		try {
			return new URL(`https://${candidate}`);
		} catch {
			return null;
		}
	}
}

export const GET: RequestHandler = async ({ url, fetch }) => {
	const raw = url.searchParams.get('url') ?? '';
	const initial = toSafeUrl(raw);

	if (!initial) {
		return json({ error: 'URL invalida.' }, { status: 400 });
	}

	if (!['http:', 'https:'].includes(initial.protocol)) {
		return json({ error: 'Solo se permiten URLs http/https.' }, { status: 400 });
	}

	if (!isAllowedGoogleMapsHost(initial.hostname)) {
		return json({ error: 'El dominio no es de Google Maps.' }, { status: 400 });
	}

	let current = initial.toString();

	try {
		for (let i = 0; i < 8; i += 1) {
			const response = await fetch(current, {
				method: 'GET',
				redirect: 'manual',
				headers: { 'User-Agent': 'Mozilla/5.0' }
			});

			if (response.status >= 300 && response.status < 400) {
				const location = response.headers.get('location');
				if (!location) {
					break;
				}

				current = new URL(location, current).toString();
				continue;
			}

			break;
		}

		return json({ resolvedUrl: current });
	} catch {
		return json({ error: 'No se pudo resolver el link.' }, { status: 502 });
	}
};