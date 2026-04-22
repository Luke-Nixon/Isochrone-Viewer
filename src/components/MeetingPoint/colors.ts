export const PERSON_PALETTE = [
    '#7c9fff',
    '#ff8c00',
    '#4ade80',
    '#f472b6',
    '#facc15',
    '#22d3ee',
    '#a78bfa',
    '#f87171',
    '#34d399',
    '#fb923c',
];

export function nextPersonColor(usedColors: string[]): string {
    for (const c of PERSON_PALETTE) {
        if (!usedColors.includes(c)) return c;
    }
    return PERSON_PALETTE[usedColors.length % PERSON_PALETTE.length];
}

export const MEETING_POINT_COLOR = '#ffffff';
export const INTERSECTION_COLOR = '#ffd166';
