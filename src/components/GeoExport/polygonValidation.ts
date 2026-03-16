export interface ValidationResult {
    valid: boolean;
    issues: string[];
}

// ── Individual checks ─────────────────────────────────────────────────────────

export function isClosed(ring: [number, number][]): boolean {
    if (ring.length < 2) return false;
    const [f, l] = [ring[0], ring[ring.length - 1]];
    return f[0] === l[0] && f[1] === l[1];
}

export function hasMinPoints(ring: [number, number][], min = 4): boolean {
    return ring.length >= min;
}

export function hasValidCoordinates(ring: [number, number][]): boolean {
    return ring.every(([lat, lng]) =>
        lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    );
}

export function isWithinUKBounds(ring: [number, number][]): boolean {
    return ring.every(([lat, lng]) =>
        lat >= 49.0 && lat <= 61.0 && lng >= -9.0 && lng <= 3.0
    );
}

// Cross product of vectors OA and OB
function cross(o: [number, number], a: [number, number], b: [number, number]): number {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

// Returns true if segment (p1,p2) and (p3,p4) properly intersect (not at shared endpoints)
function segmentsIntersect(
    p1: [number, number], p2: [number, number],
    p3: [number, number], p4: [number, number],
): boolean {
    const d1 = cross(p3, p4, p1);
    const d2 = cross(p3, p4, p2);
    const d3 = cross(p1, p2, p3);
    const d4 = cross(p1, p2, p4);
    return d1 * d2 < 0 && d3 * d4 < 0;
}

export function isSelfIntersecting(ring: [number, number][]): boolean {
    const n = ring.length - 1; // ignore closing vertex for edge count
    for (let i = 0; i < n; i++) {
        for (let j = i + 2; j < n; j++) {
            // skip adjacent edges and the wrap-around pair
            if (i === 0 && j === n - 1) continue;
            if (segmentsIntersect(ring[i], ring[i + 1], ring[j], ring[j + 1])) {
                return true;
            }
        }
    }
    return false;
}

// Signed shoelace — positive = CCW, negative = CW
export function signedArea(ring: [number, number][]): number {
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
        area += ring[i][1] * ring[i + 1][0];
        area -= ring[i + 1][1] * ring[i][0];
    }
    return area / 2;
}

export function polygonArea(ring: [number, number][]): number {
    return Math.abs(signedArea(ring));
}

export function isCCW(ring: [number, number][]): boolean {
    return signedArea(ring) > 0;
}

export function ensureCCW(ring: [number, number][]): [number, number][] {
    return isCCW(ring) ? ring : [...ring].reverse();
}

// ── Fixes ─────────────────────────────────────────────────────────────────────

export function forceClose(ring: [number, number][]): [number, number][] {
    if (isClosed(ring)) return ring;
    return [...ring.slice(0, -1), ring[0]];
}

// ── Full validate + report ────────────────────────────────────────────────────

export function validate(ring: [number, number][], label = ''): ValidationResult {
    const prefix = label ? `[${label}] ` : '';
    const issues: string[] = [];

    if (!hasMinPoints(ring)) issues.push(`${prefix}Too few points (${ring.length}, need ≥ 4)`);
    if (!hasValidCoordinates(ring)) issues.push(`${prefix}Invalid lat/lng values`);
    if (!isWithinUKBounds(ring)) issues.push(`${prefix}Points outside UK bounds`);
    if (!isClosed(ring)) issues.push(`${prefix}Polygon does not close (first ≠ last)`);
    if (!isCCW(ring)) issues.push(`${prefix}Polygon is CW — Rightmove requires CCW`);
    if (isSelfIntersecting(ring)) issues.push(`${prefix}Polygon is self-intersecting`);
    if (polygonArea(ring) < 1e-6) issues.push(`${prefix}Polygon area is effectively zero`);

    return { valid: issues.length === 0, issues };
}
