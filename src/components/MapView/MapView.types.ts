export type MapTheme = 'dark' | 'light';
export type ColorSpec = string | { dark: string; light: string };

export interface MapMarkerSpec {
    id: string;
    position: [lat: number, lng: number];
    color: ColorSpec;
    radius?: number;
    weight?: number;
    fillOpacity?: number;
    label?: string;
    labelPermanent?: boolean;
    onClick?: () => void;
}

export interface MapPolygonSpec {
    id: string;
    // Accepts any GeoJSON object that Leaflet can render (Feature/FeatureCollection
    // of Polygon or MultiPolygon). Typed loosely to accommodate Zod-derived shapes
    // whose `coordinates` is `unknown[]` after schema validation.
    data: GeoJSON.GeoJsonObject;
    color: ColorSpec;
    fillColor?: ColorSpec;
    fillOpacity?: number;
    weight?: number;
    dashArray?: string;
}

export interface MapFocus {
    points: [number, number][]; // [lat, lng]
    singlePointZoom?: number;
    fitPadding?: number;
}

export function resolveColor(spec: ColorSpec, theme: MapTheme): string {
    return typeof spec === 'string' ? spec : spec[theme];
}
