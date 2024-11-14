<script lang="ts">
	import { onMount } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	// @ts-ignore
	import MapboxDirections from '@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import * as Drawer from '$lib/components/ui/drawer';
	import { Alert, AlertTitle, AlertDescription } from '$lib/components/ui/alert';
	import { Input } from '$lib/components/ui/input';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import '@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions.css';

	interface Instruction {
		label: string;
		distance: number;
		duration: number;
	}
	let map: mapboxgl.Map;
	let directions: any;
	let marker: mapboxgl.Marker;
	let locationStatus = '';
	let is3DMode = true;
	let watchId: number | null = null;
	let initialLocationSet = false;
	let drawerOpen = false;

	// Speed unit types and conversion constants
	type SpeedUnit = 'kmh' | 'lymill';
	const KM_PER_LIGHTYEAR = 9.461e12;
	const HOURS_PER_MILLENIA = 8760000;
	let speedUnit: SpeedUnit = 'kmh';

	// Convert km/h to lightyears/millennia
	function convertToLightYearsPerMillennia(speedKmh: number): number {
		const kmPerMillenia = speedKmh * HOURS_PER_MILLENIA;
		return kmPerMillenia / KM_PER_LIGHTYEAR;
	}

	// Format speed based on current unit
	function formatSpeed(speedKmh: number): string {
		if (speedUnit === 'kmh') {
			return `${speedKmh.toFixed(1)} km/h`;
		} else {
			const lymill = convertToLightYearsPerMillennia(speedKmh);
			return `${lymill.toExponential(2)} ly/mill`;
		}
	}

	// Toggle speed unit
	function toggleSpeedUnit() {
		speedUnit = speedUnit === 'kmh' ? 'lymill' : 'kmh';
	}

	let routeSteps: Instruction[] = [];
	let routeAdditionalData = { distance: 0, duration: 0 };

	let mapContainer: HTMLDivElement;

	// Variables for speed warning and display
	let showSpeedWarning = false;
	let currentSpeed = 0;
	let averageSpeed = 0;
	let lastPosition: { lat: number; lon: number; timestamp: number } | null = null;
	let maxSpeedKmph = 1;

	let accessToken = 'REPLACE_ME__BUDDY';

	// Variables for average speed detection
	let speedBuffer: number[] = [];
	const BUFFER_SIZE = 10; // Number of speed measurements to keep

	onMount(() => {
		map = new mapboxgl.Map({
			accessToken,
			container: mapContainer,
			style: 'mapbox://styles/mapbox/streets-v12',
			center: [0, 0], // Will be updated when we get user's location
			zoom: 12,
			pitch: 45,
			bearing: -17.6,
			antialias: true
		});

		map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

		directions = new MapboxDirections({
			accessToken,
			unit: 'metric',
			profile: 'mapbox/walking',
			controls: { instructions: false }
		});

		map.addControl(directions, 'top-left');

		directions.on('route', (e: any) => {
			const routes = e.route;

			if (routes && routes.length > 0) {
				routeSteps = routes[0].legs[0].steps.map(
					(step: any): Instruction => ({
						label: step.maneuver.instruction,
						distance: parseFloat((step.distance / 1000).toFixed(2)),
						duration: parseFloat((step.duration / 60).toFixed(2))
					})
				);

				routeAdditionalData = {
					distance: parseFloat((routes[0].distance / 1000).toFixed(2)),
					duration: parseFloat((routes[0].duration / 60).toFixed(2))
				};
			}
		});

		marker = new mapboxgl.Marker();

		map.on('load', () => {
			map.addLayer({
				id: '3d-buildings',
				source: 'composite',
				'source-layer': 'building',
				filter: ['==', 'extrude', 'true'],
				type: 'fill-extrusion',
				minzoom: 15,
				paint: {
					'fill-extrusion-color': '#aaa',
					'fill-extrusion-height': ['get', 'height'],
					'fill-extrusion-base': ['get', 'min_height'],
					'fill-extrusion-opacity': 0.6
				}
			});
		});
	});

	function toggle3DMode() {
		is3DMode = !is3DMode;
		map.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', is3DMode ? 0.6 : 0);
		map.easeTo({ pitch: is3DMode ? 50 : 0, duration: 1000 });
	}

	function calculateSpeed(
		lat1: number,
		lon1: number,
		lat2: number,
		lon2: number,
		time1: number,
		time2: number
	) {
		const R = 6371; // Earth's radius in km
		const dLat = ((lat2 - lat1) * Math.PI) / 180;
		const dLon = ((lon2 - lon1) * Math.PI) / 180;
		const a =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos((lat1 * Math.PI) / 180) *
				Math.cos((lat2 * Math.PI) / 180) *
				Math.sin(dLon / 2) *
				Math.sin(dLon / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		const distance = R * c;
		const timeDiff = (time2 - time1) / 1000 / 3600; // Convert to hours
		return distance / timeDiff; // Speed in km/h
	}

	function startLocationTracking() {
		if (navigator.geolocation) {
			if (watchId === null) {
				locationStatus = 'Locating...';
				watchId = navigator.geolocation.watchPosition(showPosition, showError, {
					enableHighAccuracy: true,
					timeout: 5000,
					maximumAge: 0
				});
			} else {
				locationStatus = 'Already tracking location.';
			}
		} else {
			locationStatus = 'Geolocation is not supported by this browser.';
		}
	}

	async function showPosition(position: GeolocationPosition) {
		const lat = position.coords.latitude;
		const lon = position.coords.longitude;
		const timestamp = position.timestamp;
		
		locationStatus = `Accuracy: ${position.coords.accuracy.toFixed(2)} meters`;

		if (!initialLocationSet) {
			map.flyTo({ center: [lon, lat], essential: true });
			initialLocationSet = true;
		}

		marker.setLngLat([lon, lat]).addTo(map);
		directions.setOrigin([lon, lat]);

		// Calculate speed
		if (lastPosition) {
			currentSpeed = calculateSpeed(
				lastPosition.lat,
				lastPosition.lon,
				lat,
				lon,
				lastPosition.timestamp,
				timestamp
			);

			// Update speed buffer
			speedBuffer.push(currentSpeed);
			if (speedBuffer.length > BUFFER_SIZE) {
				speedBuffer.shift();
			}

			// Calculate average speed
			averageSpeed = calculateAverageSpeed();

			// Check if average speed is higher than maxSpeedKmph
			if (averageSpeed > maxSpeedKmph) {
				if (!showSpeedWarning) {
					showSpeedWarning = true;
					const street = await reverseGeocode(lat, lon);
					const coordinates = `${lat}, ${lon}`;
					await reportSpeeding(street, coordinates, averageSpeed);

					// Clear warning after 5 seconds
					setTimeout(() => {
						showSpeedWarning = false;
					}, 5000);
				}
			} else {
				showSpeedWarning = false;
			}
		}

		lastPosition = { lat, lon, timestamp };
	}

	function calculateAverageSpeed(): number {
		if (speedBuffer.length === 0) return 0;
		const sum = speedBuffer.reduce((acc, speed) => acc + speed, 0);
		return sum / speedBuffer.length;
	}

	function showError(error: GeolocationPositionError) {
		switch (error.code) {
			case error.PERMISSION_DENIED:
				locationStatus = 'Location access denied.';
				break;
			case error.POSITION_UNAVAILABLE:
				locationStatus = 'Location unavailable.';
				break;
			case error.TIMEOUT:
				locationStatus = 'Location request timed out.';
				break;
			default:
				locationStatus = 'An unknown error occurred.';
				break;
		}
		stopLocationTracking();
	}

	function stopLocationTracking() {
		if (watchId !== null) {
			navigator.geolocation.clearWatch(watchId);
			watchId = null;
		}
	}

	async function reportSpeeding(street: string, coordinates: string, speed: number) {
		try {
			const response = await fetch('/api/alert', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ street, coordinates, speed: formatSpeed(speed) })
			});

			if (!response.ok) {
				throw new Error('Network response was not ok');
			}

			const data = await response.json();
			console.log('SMS sent successfully:', data);
			return data;
		} catch (error) {
			console.error('Error reporting speeding:', error);
			throw error;
		}
	}

	async function reverseGeocode(lat: number, lon: number): Promise<string> {
		try {
			const response = await fetch(
				`https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?access_token=${accessToken}`
			);
			const data = await response.json();

			const street =
				data.features.find((feature: any) => feature.place_type.includes('address'))?.text ||
				'Unknown Street';
			return street;
		} catch (error) {
			console.error('Error reverse geocoding:', error);
			return 'Unknown Street';
		}
	}

	function updateMaxSpeed(event: Event) {
		const inputElement = event.target as HTMLInputElement;
		if (speedUnit === 'kmh') {
			maxSpeedKmph = parseFloat(inputElement.value) || 15;
		} else {
			// Convert from ly/mill to km/h when setting max speed
			const lymill = parseFloat(inputElement.value) || 0;
			maxSpeedKmph = (lymill * KM_PER_LIGHTYEAR) / HOURS_PER_MILLENIA;
		}
	}

	let isDrawerOpen = false;
</script>

<svelte:head>
	<title>Mapbox iOS-style Navigation</title>
</svelte:head>

<div class="app-container">
	<div class="map-container" bind:this={mapContainer}></div>

	<div class="controls">
		<Button on:click={toggle3DMode}>{is3DMode ? '2D' : '3D'}</Button>
		<Button on:click={startLocationTracking}>📍</Button>
		<Button on:click={toggleSpeedUnit}>{speedUnit === 'kmh' ? 'km/h' : 'ly/mill'}</Button>
	</div>

	<Card class="status-card">
		<CardContent>
			<p>{locationStatus}</p>
		</CardContent>
	</Card>

	<Alert class="fixed bottom-24 left-1/2 z-20 w-[90%] max-w-[400px] -translate-x-1/2 transform">
		<AlertTitle>Speed Alert</AlertTitle>
		<AlertDescription>
			{#if showSpeedWarning}
				Highest recorded speed: <span class="inline-block rounded-md bg-red-300 p-1 text-black">
					{formatSpeed(averageSpeed)}
				</span>
				Police has been <span class="text-red-600">NOTIFIED</span>.
			{:else}
				You're moving at a safe speed. Keep it up!
			{/if}
		</AlertDescription>
	</Alert>

	<Input
		type="number"
		placeholder={speedUnit === 'kmh' ? 'Max speed (km/h)' : 'Max speed (ly/mill)'}
		value={speedUnit === 'kmh' ? maxSpeedKmph : convertToLightYearsPerMillennia(maxSpeedKmph)}
		on:input={updateMaxSpeed}
		class="fixed bottom-44 mb-2 w-[20%]"
	/>

	<Drawer.Root bind:open={isDrawerOpen}>
		<Drawer.Trigger asChild let:builder>
			<div class="drawer-trigger">
				<Button builders={[builder]}>Directions</Button>
				<p class="speed-text">
					Current: {formatSpeed(currentSpeed)} | Avg: {formatSpeed(averageSpeed)}
				</p>
			</div>
		</Drawer.Trigger>
		<Drawer.Content class="p-4">
			<Drawer.Header>
				<Drawer.Title class="mb-4 text-xl font-bold">Navigation Steps</Drawer.Title>
			</Drawer.Header>
			<div class="space-y-4">
				{#if routeAdditionalData.distance !== null && routeAdditionalData.duration !== null}
					<p class="rounded bg-gray-100 p-2 text-sm font-semibold">
						Total: {routeAdditionalData.distance} km | {routeAdditionalData.duration} min
					</p>
				{/if}
				<div class="max-h-[60vh] space-y-4 overflow-y-auto pr-2">
					{#each routeSteps as step}
						<div class="flex items-start border-b border-gray-200 pb-2">
							<div>
								<p class="font-medium">{step.label}</p>
								<p class="text-secondary-foreground text-sm">
									{step.distance} km | {step.duration} min
								</p>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</Drawer.Content>
	</Drawer.Root>
</div>

<style lang="postcss">
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
		height: 100vh;
		overflow: hidden;
	}

	.app-container {
		position: relative;
		width: 100%;
		height: 100vh;
		overflow: hidden;
	}

	.map-container {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 0;
	}

	.controls {
		position: absolute;
		top: 1rem;
		left: 1rem;
		z-index: 10;
		display: flex;
		gap: 0.5rem;
	}

	.status-card {
		position: absolute;
		bottom: 5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10;
		background-color: rgba(255, 255, 255, 0.8);
		backdrop-filter: blur(4px);
	}

	.speed-text {
		font-size: 1rem;
		font-weight: bold;
		text-align: center;
		white-space: nowrap;
	}

	.drawer-trigger {
		position: fixed;
		bottom: 1rem;
		left: 0;
		right: 0;
		margin: 0 auto;
		width: fit-content;
		z-index: 10;
	}

	:global(.mapboxgl-ctrl-top-left) {
		top: 4rem !important;
	}
</style>
