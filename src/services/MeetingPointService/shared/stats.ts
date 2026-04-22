import type { AggregateStats } from '../types';

export function aggregate(times: number[]): AggregateStats {
    const total = times.reduce((s, t) => s + t, 0);
    const mean = total / times.length;
    const variance = times.reduce((s, t) => s + (t - mean) ** 2, 0) / times.length;
    const max = Math.max(...times);
    return { total, mean, variance, max };
}
