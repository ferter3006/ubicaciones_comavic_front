<script lang="ts">
	import { pb } from '$lib/pocketbase';
	import { tick } from 'svelte';
	import type { RecordModel } from 'pocketbase';
	import GoogleMap from '$lib/components/GoogleMap.svelte';

	let search = $state('');
	let results = $state<RecordModel[]>([]);
	let loading = $state(false);
	let error = $state('');
	let selectedItem = $state<RecordModel | null>(null);

	const minLength = 3;
	const collection = 'ubicaciones';

	function getDirectionsUrl(item: RecordModel | null): string {
		if (!item?.geo_point) {
			return '';
		}

		const point = item.geo_point as {
			lat?: number;
			lon?: number;
			latitude?: number;
			longitude?: number;
		};

		const lat = Number(point.lat ?? point.latitude);
		const lng = Number(point.lon ?? point.longitude);

		if (Number.isNaN(lat) || Number.isNaN(lng)) {
			return '';
		}

		return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
	}

	let directionsUrl = $derived(getDirectionsUrl(selectedItem));

	async function fetchResults(query: string) {
		loading = true;
		error = '';
		try {
			const safeQuery = query.replace(/'/g, "\\'");
			const res = await pb.collection(collection).getList(1, 10, {
				filter: `name ~ '${safeQuery}'`
			});

			results = [];
			for (const item of res.items) {
				results = [...results, item];
				await tick();
			}
		} catch (e) {
			error = 'Error consultando la base de datos' + (e instanceof Error ? `: ${e.message}` : '');
			results = [];
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (search.length >= minLength) {
			fetchResults(search);
		} else {
			results = [];
		}
	});

	function onSelectedItem(item: RecordModel) {
		selectedItem = item;
		search = '';
	}
</script>

<div class="flex min-h-screen flex-col items-center bg-primary p-4">
	<h1 class="text-2xl font-bold text-white">Ubicaciones:</h1>
	<div class="w-full max-w-xl">
		<label for="search" class="mb-2 block text-lg font-medium">Buscar:</label>
		<textarea
			id="search"
			class="focus:ring-opacity-50 w-full resize-none rounded-md border-gray-300 p-2 shadow-sm focus:border-sky-500 focus:ring focus:ring-sky-200"
			rows="2"
			bind:value={search}
			placeholder="Introduce tu búsqueda..."
		></textarea>
		{#if loading}
			<div class="mt-2 text-sky-600">Buscando...</div>
		{/if}
		{#if error}
			<div class="mt-2 text-red-600">{error}</div>
		{/if}
		{#if results.length > 0}
			<div
				class="mt-4 max-h-80 overflow-y-auto rounded-md border border-gray-200 bg-white p-2 shadow-sm"
			>
				<ul class="space-y-2">
					{#each results as item (item.id)}
						<li>
							<button
								type="button"
								class="w-full cursor-pointer rounded border p-3 text-left transition-colors {selectedItem?.id ===
								item.id
									? 'border-primary bg-primary/10'
									: 'border-gray-100 bg-gray-50 hover:bg-gray-100'}"
								onclick={() => onSelectedItem(item)}
							>
								<p class="text-sm font-semibold text-gray-800">{item.name ?? 'Sin nombre'}</p>
								<p class="mt-1 text-xs break-all text-gray-600">{item.city ?? 'Sin ciudad'}</p>
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{:else if search.length >= minLength && !loading && !error}
			<div class="mt-4 rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-600">
				No se encontraron resultados.
			</div>
		{/if}

		{#if selectedItem}
			<div class="mt-6 w-full">
				<div class="mb-2 flex justify-center">
					<p class="text-center text-lg font-medium text-white">{selectedItem.name}</p>
				</div>
				<GoogleMap geo_point={selectedItem.geo_point} label={selectedItem.name} />
				<div class="mt-3 w-full">
					<button
						type="button"
						onclick={() => window.open(directionsUrl, '_blank', 'noopener,noreferrer')}
						class="w-full cursor-pointer rounded-md bg-secondary px-5 py-2 text-center text-lg font-semibold text-black shadow-sm transition hover:bg-gray-100"
					>
						Como llegar
					</button>
				</div>
			</div>
		{/if}
		<div class="mt-3 w-full">
			<button
				type="button"
				onclick={() => (window.location.href = '/create_ubicacion')}
				class="mt-[25%] block w-full cursor-pointer rounded-md bg-white px-5 py-2 text-center text-lg font-semibold text-black shadow-sm transition hover:bg-gray-100"
			>
				Agregar Nueva
			</button>
		</div>
	</div>
</div>
