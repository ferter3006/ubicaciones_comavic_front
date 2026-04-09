<script lang="ts">
	import { onMount } from 'svelte';
	import { pb } from '$lib/pocketbase';
	import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
	import { PUBLIC_GOOGLE_MAPS_API_KEY } from '$env/static/public';

	let name = $state('');
	let city = $state('');
	let ubicacionLink = $state('');
	let lat = $state<number | null>(null);
	let lng = $state<number | null>(null);

	let mapEl: HTMLDivElement;
	let map: google.maps.Map | null = null;
	let marker: google.maps.Marker | null = null;

	let loadingMap = $state(true);
	let submitting = $state(false);
	let error = $state('');
	let success = $state('');

	const fallbackPosition = { lat: 40.4167754, lng: -3.7037902 };

	function normalizeUrl(input: string): URL | null {
		try {
			return new URL(input);
		} catch {
			try {
				return new URL(`https://${input}`);
			} catch {
				return null;
			}
		}
	}

	function parseGoogleMapsCoordinates(rawUrl: string): { lat: number; lng: number } | null {
		const parsed = normalizeUrl(rawUrl.trim());
		if (!parsed) {
			return null;
		}

		const decoded = decodeURIComponent(parsed.toString());

		const atPattern = decoded.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
		if (atPattern) {
			return { lat: Number(atPattern[1]), lng: Number(atPattern[2]) };
		}

		const qParam = parsed.searchParams.get('q') ?? parsed.searchParams.get('query');
		if (qParam) {
			const qMatch = qParam.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
			if (qMatch) {
				return { lat: Number(qMatch[1]), lng: Number(qMatch[2]) };
			}
		}

		const llParam = parsed.searchParams.get('ll');
		if (llParam) {
			const llMatch = llParam.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
			if (llMatch) {
				return { lat: Number(llMatch[1]), lng: Number(llMatch[2]) };
			}
		}

		const dataPattern = decoded.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
		if (dataPattern) {
			return { lat: Number(dataPattern[1]), lng: Number(dataPattern[2]) };
		}

		return null;
	}

	async function resolveGoogleMapsLink(rawUrl: string): Promise<string | null> {
		const endpoint = `/api/resolve-map-link?url=${encodeURIComponent(rawUrl.trim())}`;
		try {
			const response = await fetch(endpoint);
			if (!response.ok) {
				return null;
			}

			const data = (await response.json()) as { resolvedUrl?: string };
			return data.resolvedUrl ?? null;
		} catch {
			return null;
		}
	}

	async function useLinkOnMap() {
		error = '';
		success = '';

		if (!ubicacionLink.trim()) {
			error = 'Pega primero un link de Google Maps.';
			return;
		}

		let coords = parseGoogleMapsCoordinates(ubicacionLink);

		if (!coords) {
			const resolvedLink = await resolveGoogleMapsLink(ubicacionLink);
			if (resolvedLink) {
				coords = parseGoogleMapsCoordinates(resolvedLink);
			}
		}

		if (!coords || Number.isNaN(coords.lat) || Number.isNaN(coords.lng)) {
			error =
				'No pude extraer coordenadas del link. Si es un enlace corto, revisa que sea de Google Maps; tambien puedes mover el marcador manualmente.';
			return;
		}

		updatePosition(coords.lat, coords.lng, true);
		success = 'Coordenadas cargadas desde el link.';
	}

	function updatePosition(nextLat: number, nextLng: number, pan = true) {
		lat = Number(nextLat.toFixed(7));
		lng = Number(nextLng.toFixed(7));

		if (marker) {
			marker.setPosition({ lat, lng });
		}

		if (pan && map) {
			map.panTo({ lat, lng });
		}
	}

	function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
		return new Promise((resolve) => {
			if (!navigator.geolocation) {
				resolve(fallbackPosition);
				return;
			}

			navigator.geolocation.getCurrentPosition(
				(position) => {
					resolve({
						lat: position.coords.latitude,
						lng: position.coords.longitude
					});
				},
				() => {
					resolve(fallbackPosition);
				},
				{ enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
			);
		});
	}

	async function centerOnDevicePosition() {
		const pos = await getCurrentPosition();
		updatePosition(pos.lat, pos.lng, true);
	}

	onMount(async () => {
		setOptions({
			key: PUBLIC_GOOGLE_MAPS_API_KEY,
			v: 'weekly'
		});

		loadingMap = true;
		const initialPos = await getCurrentPosition();

		const { Map } = await importLibrary('maps');
		map = new Map(mapEl, {
			center: initialPos,
			zoom: 16,
			mapTypeId: 'hybrid',
			mapTypeControl: false,
			streetViewControl: false
		});

		updatePosition(initialPos.lat, initialPos.lng, false);

		marker = new google.maps.Marker({
			map,
			position: initialPos,
			draggable: true,
			title: 'Ubicacion seleccionada'
		});

		map.addListener('click', (event: google.maps.MapMouseEvent) => {
			if (!event.latLng) {
				return;
			}

			updatePosition(event.latLng.lat(), event.latLng.lng(), false);
		});

		marker.addListener('dragend', () => {
			const position = marker?.getPosition();
			if (!position) {
				return;
			}

			updatePosition(position.lat(), position.lng(), false);
		});

		loadingMap = false;
	});

	async function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		success = '';

		if (!name.trim() || !city.trim()) {
			error = 'Nombre y ciudad son obligatorios.';
			return;
		}

		if (lat === null || lng === null) {
			error = 'Selecciona un punto en el mapa antes de guardar.';
			return;
		}

		submitting = true;
		try {
			const finalLink =
				ubicacionLink.trim() || `https://www.google.com/maps?q=${lat},${lng}`;

			await pb.collection('ubicaciones').create({
				name: name.trim(),
				city: city.trim(),
				ubicacion_link: finalLink,
				geo_point: {
					lat,
					lon: lng
				}
			});

			success = 'Ubicacion creada correctamente.';
			name = '';
			city = '';
			ubicacionLink = '';
			setTimeout(() => (window.location.href = '/'), 1000);
		} catch (e) {
			error = e instanceof Error ? e.message : 'No se pudo crear la ubicacion.';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="flex min-h-screen flex-col items-center bg-primary p-4">
	<div class="w-full max-w-xl">
		<div class="mb-4 flex items-center justify-between gap-2">
			<h1 class="text-2xl font-bold text-white">Crear ubicacion</h1>
			<button
				type="button"
				onclick={() => (window.location.href = '/')}
				class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-black shadow-sm transition hover:bg-gray-100"
			>
				Volver
			</button>
		</div>

		<form class="space-y-3" onsubmit={onSubmit}>
			<div>
				<label for="name" class="mb-1 block text-sm font-medium text-white">Nombre</label>
				<input
					id="name"
					type="text"
					required
					bind:value={name}
					placeholder="Ej: Nave industrial Comavic"
					class="w-full rounded-md border-gray-300 p-2 shadow-sm"
				/>
			</div>

			<div>
				<label for="city" class="mb-1 block text-sm font-medium text-white">Ciudad</label>
				<input
					id="city"
					type="text"
					required
					bind:value={city}
					placeholder="Ej: Tortosa"
					class="w-full rounded-md border-gray-300 p-2 shadow-sm"
				/>
			</div>

			<div>
				<label for="ubicacionLink" class="mb-1 block text-sm font-medium text-white"
					>Ubicacion link (opcional)</label
				>
				<input
					id="ubicacionLink"
					type="url"
					bind:value={ubicacionLink}
					placeholder="https://maps.google.com/..."
					class="w-full rounded-md border-gray-300 p-2 shadow-sm"
				/>
				<div class="mt-2">
					<button
						type="button"
						onclick={useLinkOnMap}
						class="rounded-md bg-secondary px-3 py-2 text-sm font-semibold text-black shadow-sm transition hover:bg-gray-100"
					>
						Usar link en el mapa
					</button>
				</div>
			</div>

			<div class="rounded-md bg-white/10 p-3">
				<p class="text-sm font-medium text-white">Seleccion de punto</p>
				<p class="mt-1 text-xs text-white/90">
					El mapa se centra en tu ubicacion actual. Haz click en el mapa o arrastra el marcador para
					ajustar el punto.
				</p>
				<div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
					<div>
						<label for="latitud" class="mb-1 block text-xs text-white/90">Latitud</label>
						<input
							id="latitud"
							type="text"
							readonly
							value={lat ?? ''}
							class="w-full rounded-md border-gray-300 p-2 text-sm shadow-sm"
						/>
					</div>
					<div>
						<label for="longitud" class="mb-1 block text-xs text-white/90">Longitud</label>
						<input
							id="longitud"
							type="text"
							readonly
							value={lng ?? ''}
							class="w-full rounded-md border-gray-300 p-2 text-sm shadow-sm"
						/>
					</div>
				</div>
				<div class="mt-2">
					<button
						type="button"
						onclick={centerOnDevicePosition}
						class="rounded-md bg-secondary px-3 py-2 text-sm font-semibold text-black shadow-sm transition hover:bg-gray-100"
					>
						Usar mi ubicacion actual
					</button>
				</div>
			</div>

			<div class="h-96 w-full overflow-hidden rounded-md shadow-md">
				<div bind:this={mapEl} class="h-full w-full"></div>
			</div>
			{#if loadingMap}
				<p class="text-sm text-white">Cargando mapa...</p>
			{/if}

			{#if error}
				<p class="rounded-md bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>
			{/if}
			{#if success}
				<p class="rounded-md bg-green-100 px-3 py-2 text-sm text-green-700">{success}</p>
			{/if}

			<button
				type="submit"
				disabled={submitting}
				class="w-full rounded-md bg-white px-5 py-2 text-center text-lg font-semibold text-black shadow-sm transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
			>
				{submitting ? 'Guardando...' : 'Guardar ubicacion'}
			</button>
		</form>
	</div>
</div>
