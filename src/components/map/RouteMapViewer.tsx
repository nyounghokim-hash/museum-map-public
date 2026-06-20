'use client';
import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import type { CircleLayerSpecification, ExpressionSpecification, LineLayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface RouteStop {
    name: string;
    latitude: number;
    longitude: number;
    order: number;
    museumId?: string;
    visitedAt?: string | Date | null;
    reviewId?: string | null;
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
const VISITED_STOP_COLOR = '#10B981';
const VISITED_STOP_COLOR_DARK = '#34D399';
const ROUTE_STOP_INTERACTIVE_LAYERS = ['route-stop-circles', 'route-stop-labels', 'route-stop-name'] as const;

type CirclePaint = NonNullable<CircleLayerSpecification['paint']>;
type LinePaint = NonNullable<LineLayerSpecification['paint']>;
type RouteStopProperties = {
    order: number;
    name: string;
    museumId: string;
    visited: boolean;
};

const visitedStopExpression = <T extends string | number>(visitedValue: T, defaultValue: T): ExpressionSpecification => ([
    'case',
    ['boolean', ['get', 'visited'], false],
    visitedValue,
    defaultValue,
] as unknown as ExpressionSpecification);

const currentSegmentGradient = (darkMode: boolean): ExpressionSpecification => ([
    'interpolate',
    ['linear'],
    ['line-progress'],
    0,
    darkMode ? VISITED_STOP_COLOR_DARK : VISITED_STOP_COLOR,
    1,
    ROUTE_COLOR,
] as unknown as ExpressionSpecification);

function sortRouteStops(stops: RouteStop[]) {
    return [...stops].sort((a, b) => a.order - b.order);
}

function stopCoordinate(stop: RouteStop): [number, number] {
    return [Number(stop.longitude) || 0, Number(stop.latitude) || 0];
}

function hasVisitedStop(stop: RouteStop) {
    return Boolean(stop.visitedAt || stop.reviewId);
}

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

    const buildLineGeoJSON = useCallback((s: RouteStop[]): Feature<LineString> => ({
        type: 'Feature' as const,
        properties: {},
        geometry: {
            type: 'LineString' as const,
            coordinates: sortRouteStops(s).map(stopCoordinate),
        },
    }), []);

    const buildCurrentSegmentGeoJSON = useCallback((s: RouteStop[]): FeatureCollection<LineString> => {
        const orderedStops = sortRouteStops(s);
        const lastVisitedIndex = orderedStops.reduce((latestIndex, stop, index) => (
            hasVisitedStop(stop) ? index : latestIndex
        ), -1);
        const fromStop = lastVisitedIndex >= 0 ? orderedStops[lastVisitedIndex] : null;
        const toStop = lastVisitedIndex >= 0 ? orderedStops[lastVisitedIndex + 1] : null;

        if (!fromStop || !toStop) {
            return { type: 'FeatureCollection' as const, features: [] };
        }

        return {
            type: 'FeatureCollection' as const,
            features: [{
                type: 'Feature' as const,
                properties: {},
                geometry: {
                    type: 'LineString' as const,
                    coordinates: [stopCoordinate(fromStop), stopCoordinate(toStop)],
                },
            }],
        };
    }, []);

    const buildStopsGeoJSON = useCallback((s: RouteStop[]): FeatureCollection<Point, RouteStopProperties> => ({
        type: 'FeatureCollection' as const,
        features: s.map(st => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [Number(st.longitude) || 0, Number(st.latitude) || 0] },
            properties: {
                order: st.order + 1,
                name: st.name,
                museumId: st.museumId || '',
                visited: hasVisitedStop(st),
            },
        })),
    }), []);

    const buildRouteBounds = useCallback((s: RouteStop[]) => {
        const lngs = s.map(st => Number(st.longitude) || 0);
        const lats = s.map(st => Number(st.latitude) || 0);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const lngSpan = maxLng - minLng;
        const latSpan = maxLat - minLat;

        if (lngSpan === 0 && latSpan === 0) {
            const pointBuffer = 0.01;
            return new maplibregl.LngLatBounds(
                [minLng - pointBuffer, minLat - pointBuffer],
                [maxLng + pointBuffer, maxLat + pointBuffer]
            );
        }

        const lngBuffer = Math.min(Math.max(lngSpan * 0.16, 0.0025), 0.035);
        const latBuffer = Math.min(Math.max(latSpan * 0.16, 0.0025), 0.035);
        return new maplibregl.LngLatBounds(
            [minLng - lngBuffer, minLat - latBuffer],
            [maxLng + lngBuffer, maxLat + latBuffer]
        );
    }, []);

    const handleRouteStopClick = useCallback((e: maplibregl.MapLayerMouseEvent) => {
        const feature = e.features?.[0];
        if (!feature || !onStopClick || feature.geometry.type !== 'Point') return;

        const props = feature.properties || {};
        const coordinates = feature.geometry.coordinates;
        onStopClick({
            name: String(props.name || ''),
            latitude: Number(coordinates[1]) || 0,
            longitude: Number(coordinates[0]) || 0,
            order: (Number(props.order) || 1) - 1,
            museumId: String(props.museumId || ''),
        });
    }, [onStopClick]);

    const addRouteLayers = (map: maplibregl.Map, stopsData: RouteStop[]) => {
        for (const id of ['watername_ocean', 'watername_sea']) {
            if (map.getLayer(id)) try { map.removeLayer(id); } catch { }
        }

        // Route line (solid)
        map.addSource('route-line', { type: 'geojson', data: buildLineGeoJSON(stopsData) });
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
        map.addSource('route-current-segment', {
            type: 'geojson',
            data: buildCurrentSegmentGeoJSON(stopsData),
            lineMetrics: true,
        });
        map.addLayer({
            id: 'route-current-segment-glow', type: 'line', source: 'route-current-segment',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
                'line-gradient': currentSegmentGradient(darkMode) as LinePaint['line-gradient'],
                'line-width': 8,
                'line-opacity': 0.2,
            },
        });
        map.addLayer({
            id: 'route-current-segment-layer', type: 'line', source: 'route-current-segment',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
                'line-gradient': currentSegmentGradient(darkMode) as LinePaint['line-gradient'],
                'line-width': 4,
                'line-opacity': 0.92,
            },
        });

        // Stop markers
        map.addSource('route-stops', { type: 'geojson', data: buildStopsGeoJSON(stopsData) });
        map.addLayer({
            id: 'route-stop-circles', type: 'circle', source: 'route-stops',
            paint: {
                'circle-color': visitedStopExpression(darkMode ? VISITED_STOP_COLOR_DARK : VISITED_STOP_COLOR, ROUTE_COLOR) as CirclePaint['circle-color'],
                'circle-opacity': visitedStopExpression(0.72, 1) as CirclePaint['circle-opacity'],
                'circle-radius': 16,
                'circle-stroke-width': visitedStopExpression(4, 3) as CirclePaint['circle-stroke-width'],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-opacity': visitedStopExpression(0.92, 1) as CirclePaint['circle-stroke-opacity'],
            },
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

        const bounds = buildRouteBounds(validStops);

        const map = new maplibregl.Map({
            container: mapContainer.current,
            style: darkMode ? DARK_STYLE : LIGHT_STYLE,
            bounds,
            fitBoundsOptions: { padding: resolvedPadding, maxZoom: 14.5 },
            minZoom: 2,
        });

        map.on('load', () => {
            addRouteLayers(map, validStops);
            ROUTE_STOP_INTERACTIVE_LAYERS.forEach((layerId) => {
                map.on('click', layerId, handleRouteStopClick);
                map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
                map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
            });
            initializedRef.current = true;
        });

        mapRef.current = map;
        return () => { map.remove(); mapRef.current = null; initializedRef.current = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [buildRouteBounds]);

    const darkModeRef = useRef(darkMode);
    useEffect(() => {
        if (!mapRef.current || darkModeRef.current === darkMode) return;
        darkModeRef.current = darkMode;
        const map = mapRef.current;
        map.setStyle(darkMode ? DARK_STYLE : LIGHT_STYLE);
        map.once('style.load', () => { addRouteLayers(map, validStops); });
    }, [darkMode, buildLineGeoJSON, buildCurrentSegmentGeoJSON, buildStopsGeoJSON, validStops]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !initializedRef.current || validStops.length === 0) return;
        const lineSource = map.getSource('route-line') as maplibregl.GeoJSONSource | undefined;
        const currentSegmentSource = map.getSource('route-current-segment') as maplibregl.GeoJSONSource | undefined;
        const stopsSource = map.getSource('route-stops') as maplibregl.GeoJSONSource | undefined;
        if (lineSource) lineSource.setData(buildLineGeoJSON(validStops));
        if (currentSegmentSource) currentSegmentSource.setData(buildCurrentSegmentGeoJSON(validStops));
        if (stopsSource) stopsSource.setData(buildStopsGeoJSON(validStops));
    }, [stops, buildLineGeoJSON, buildCurrentSegmentGeoJSON, buildStopsGeoJSON]);

    // Refit bounds when padding changes (e.g., sheet expand/collapse) or stops change
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !initializedRef.current || validStops.length === 0) return;
        map.fitBounds(buildRouteBounds(validStops), { padding: resolvedPadding, duration: 600, maxZoom: 14.5 });
    }, [resolvedPadding.top, resolvedPadding.bottom, resolvedPadding.left, resolvedPadding.right, validStops.length, buildRouteBounds]);

    return <div ref={mapContainer} className="w-full h-full" />;
}
