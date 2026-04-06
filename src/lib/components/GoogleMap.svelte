<script lang="ts">
	import { onMount } from 'svelte';
	import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
	import { PUBLIC_GOOGLE_MAPS_API_KEY } from '$env/static/public';

	interface Props {
		geo_point: {
			lat?: number;
			lon?: number;
			latitude?: number;
			longitude?: number;
		};
		label: string;
	}

	let { geo_point, label }: Props = $props();

	const getLat = (point: Props['geo_point']) => Number(point.lat ?? point.latitude);
	const getLng = (point: Props['geo_point']) => Number(point.lon ?? point.longitude);

	let lat = $derived(getLat(geo_point));
	let lng = $derived(getLng(geo_point));

	let mapEl: HTMLDivElement;
	let map: google.maps.Map | null = null;
	let marker: google.maps.marker.AdvancedMarkerElement | null = null;

	onMount(async () => {
		setOptions({
			key: PUBLIC_GOOGLE_MAPS_API_KEY,
			v: 'weekly'
		});

		if (Number.isNaN(lat) || Number.isNaN(lng)) {
			return;
		}

		const { Map } = await importLibrary('maps');
		const { AdvancedMarkerElement } = await importLibrary('marker');

		map = new Map(mapEl, {
			center: { lat, lng },
			zoom: 15,
			mapId: 'DEMO_MAP_ID',
			mapTypeId: 'hybrid',
			mapTypeControl: false,
			streetViewControl: false
		});

		marker = new AdvancedMarkerElement({
			map,
			position: { lat, lng },
			title: label
		});
	});

	$effect(() => {
		if (map && marker && !Number.isNaN(lat) && !Number.isNaN(lng)) {
			const pos = { lat, lng };
			map.setMapTypeId('hybrid');
			map.setCenter(pos);
			marker.position = pos;
			marker.title = label;
		}
	});
</script>

<div bind:this={mapEl} class="h-96 w-full rounded-md shadow-md"></div>
