'use client';
import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface RouteStop {
    name: string;
    latitude: number;
    longitude: number;
    order: number;
    museumId?: string;
}

interface Props {
    stops: RouteStop[];
    onStopClick?: (stop: RouteStop) => void;
    darkMode?: boolean;
    /** Padding (px) reserved at each edge so the route fits in the unobstructed viewport. */
    padding?: { top?: number; bottom?: number; left?: number; right?: number };
}

const LIGHT_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const ROUTE_COLOR = '#2563EB';

export default function RouteMapViewer({ stops = [], onStopClick, darkMode = false, padding }: Props) {
    const validStops = Array.isArray(stops) ? stops : [];
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const initializedRef = useRef(false);
    const resolvedPadding = {
        top: padding?.top ?? 60,
        bottom: padding?.bottom ?? 60,
        left: padding?.left ?? 60,
        right: padding?.right ?? 60,
    };

    const buildLineGeoJSON = useCallback((s: RouteStop[]) => ({
        type: 'Feature' as const,
        properties: {},
        geometry: {
            type: 'LineString' as const,
            coordinates: [...s]
                .sort((a, b) => a.order - b.order)
                .map(st => [Number(st.longitude) || 0, Number(st.latitude) || 0] as [number, number]),
        },
    }), []);

    const buildStopsGeoJSON = useCallback((s: RouteStop[]) => ({
        type: 'FeatureCollection' as const,
        features: s.map(st => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [Number(st.longitude) || 0, Number(st.latitude) || 0] },
            properties: { order: st.order + 1, name: st.name, museumId: st.museumId || '' },
        })),
    }), []);

    const addRouteLayers = (map: maplibregl.Map, stopsData: RouteStop[]) => {
        for (const id of ['watername_ocean', 'watername_sea']) {
            if (map.getLayer(id)) try { map.removeLayer(id); } catch { }
        }

        // Route line (solid)
        map.addSource('route-line', { type: 'geojson', data: buildLineGeoJSON(stopsData) as any });
        map.addLayer({
            id: 'route-line-bg', type: 'line', source: 'route-line',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': ROUTE_COLOR, 'line-width': 6, 'line-opacity': 0.16 },
        });
        map.addLayer({
            id: 'route-line-layer', type: 'line', source: 'route-line',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': ROUTE_COLOR, 'line-width': 3, 'line-opacity': 0.78 },
        });

        // Stop markers
        map.addSource('route-stops', { type: 'geojson', data: buildStopsGeoJSON(stopsData) as any });
        map.addLayer({
            id: 'route-stop-circles', type: 'circle', source: 'route-stops',
            paint: { 'circle-color': ROUTE_COLOR, 'circle-radius': 16, 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' },
        });
        map.addLayer({
            id: 'route-stop-labels', type: 'symbol', source: 'route-stops',
            layout: { 'text-field': ['to-string', ['get', 'order']], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 13, 'text-allow-overlap': true },
            paint: { 'text-color': '#ffffff' },
        });
        map.addLayer({
            id: 'route-stop-name', type: 'symbol', source: 'route-stops',
            layout: { 'text-field': ['get', 'name'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 11, 'text-offset': [0, 2.2], 'text-anchor': 'top', 'text-max-width': 12 },
            paint: { 'text-color': '#333333', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
        });
    };

    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;
        if (!validStops || validStops.length === 0) return;

        const lngs = validStops.map(s => Number(s.longitude) || 0);
        const lats = validStops.map(s => Number(s.latitude) || 0);
        const bounds = new maplibregl.LngLatBounds(
            [Math.min(...lngs) - 0.1, Math.min(...lats) - 0.1],
            [Math.max(...lngs) + 0.1, Math.max(...lats) + 0.1]
        );

        const map = new maplibregl.Map({
            container: mapContainer.current,
            style: darkMode ? DARK_STYLE : LIGHT_STYLE,
            bounds,
            fitBoundsOptions: { padding: resolvedPadding },
            minZoom: 2,
        });

        map.on('load', () => {
            addRouteLayers(map, validStops);
            map.on('click', 'route-stop-circles', (e) => {
                const feature = e.features?.[0];
                if (feature && onStopClick) {
                    const props = feature.properties;
                    const coords = (feature.geometry as any).coordinates;
                    onStopClick({ name: props?.name || '', latitude: coords[1], longitude: coords[0], order: (props?.order || 1) - 1, museumId: props?.museumId || '' });
                }
            });
            map.on('mouseenter', 'route-stop-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', 'route-stop-circles', () => { map.getCanvas().style.cursor = ''; });
            initializedRef.current = true;
        });

        mapRef.current = map;
        return () => { map.remove(); mapRef.current = null; initializedRef.current = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const darkModeRef = useRef(darkMode);
    useEffect(() => {
        if (!mapRef.current || darkModeRef.current === darkMode) return;
        darkModeRef.current = darkMode;
        const map = mapRef.current;
        map.setStyle(darkMode ? DARK_STYLE : LIGHT_STYLE);
        map.once('style.load', () => { addRouteLayers(map, validStops); });
    }, [darkMode, buildLineGeoJSON, buildStopsGeoJSON, validStops]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !initializedRef.current || validStops.length === 0) return;
        const lineSource = map.getSource('route-line') as maplibregl.GeoJSONSource | undefined;
        const stopsSource = map.getSource('route-stops') as maplibregl.GeoJSONSource | undefined;
        if (lineSource) lineSource.setData(buildLineGeoJSON(validStops) as any);
        if (stopsSource) stopsSource.setData(buildStopsGeoJSON(validStops) as any);
    }, [stops, buildLineGeoJSON, buildStopsGeoJSON]);

    // Refit bounds when padding changes (e.g., sheet expand/collapse) or stops change
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !initializedRef.current || validStops.length === 0) return;
        const lngs = validStops.map(s => Number(s.longitude) || 0);
        const lats = validStops.map(s => Number(s.latitude) || 0);
        const bounds = new maplibregl.LngLatBounds(
            [Math.min(...lngs) - 0.05, Math.min(...lats) - 0.05],
            [Math.max(...lngs) + 0.05, Math.max(...lats) + 0.05]
        );
        map.fitBounds(bounds, { padding: resolvedPadding, duration: 600 });
    }, [resolvedPadding.top, resolvedPadding.bottom, resolvedPadding.left, resolvedPadding.right, validStops.length]);

    return <div ref={mapContainer} className="w-full h-full" />;
}
