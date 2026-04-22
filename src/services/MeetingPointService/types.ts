import type { GeocodingResult } from '../GeocodingService';
import type { ValhallaCosting } from '../IsochroneService';

export type MeetingMode =
    | 'minimax'
    | 'leximin'
    | 'utilitarian'
    | 'minVariance'
    | 'nash'
    | 'pareto';

export interface Person {
    id: string;
    label: string;
    address: GeocodingResult | null;
    mode: ValhallaCosting;
    weight: number;
    color: string;
}

export interface PersonBands {
    personId: string;
    bands: Band[];
}

export interface Band {
    minutes: number;
    polygon: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
}

export type ProgressPhase = 'fetching' | 'retrying' | 'computing';

export interface ProgressEvent {
    phase: ProgressPhase;
    personIndex?: number;
    personLabel?: string;
    total?: number;
    /** For phase='retrying': human-readable reason (e.g., "rate limit", "timeout", "network error"). */
    retryReason?: string;
    /** For phase='retrying': 1-based attempt number (the upcoming attempt). */
    retryAttempt?: number;
    /** For phase='retrying': max attempts. */
    retryMax?: number;
}

export interface MeetingOptions {
    mode: MeetingMode;
    useWeights: boolean;
    maxMinutes: number;
    bandStepMinutes: number;
    onProgress?: (event: ProgressEvent) => void;
}

export interface PerPersonStat {
    personId: string;
    label: string;
    color: string;
    minutes: number;
    weight: number;
    weightedMinutes?: number;
}

export interface AggregateStats {
    max: number;
    mean: number;
    total: number;
    variance: number;
}

export interface Candidate {
    point: GeoJSON.Position;
    times: number[];
}

export interface MeetingResult {
    primary: Candidate;
    alternates: Candidate[];
    intersection?: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
    perPerson: PerPersonStat[];
    aggregate: AggregateStats;
    weightedAggregate?: AggregateStats;
    paretoFrontSize?: number;
    /** Set when the actual band coverage was less than requested (e.g. server dropped large contours). */
    coverageNotice?: string;
    debug?: {
        samplesEvaluated: number;
        apiCallsMade: number;
    };
}

export type MeetingPointErrorCode = 'no_intersection' | 'provider_disabled' | 'too_few_people' | 'fetch_failed';

export class MeetingPointError extends Error {
    readonly code: MeetingPointErrorCode;
    constructor(message: string, code: MeetingPointErrorCode) {
        super(message);
        this.name = 'MeetingPointError';
        this.code = code;
    }
}
