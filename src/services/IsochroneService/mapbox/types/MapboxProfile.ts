export const MapboxProfile = {
    Driving: 'driving',
    DrivingTraffic: 'driving-traffic',
    Walking: 'walking',
    Cycling: 'cycling',
} as const;

export type MapboxProfile = typeof MapboxProfile[keyof typeof MapboxProfile];
