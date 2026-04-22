// Scoring functions for sum-based fairness modes.
// All accept actual per-person times and per-person weights, and return a number to MINIMIZE.

export function utilitarianScore(times: number[], weights: number[]): number {
    return times.reduce((sum, t, i) => sum + t * weights[i], 0);
}

export function varianceScore(times: number[], weights: number[]): number {
    // Variance of weighted times around the weighted mean.
    const weighted = times.map((t, i) => t * weights[i]);
    const mean = weighted.reduce((s, w) => s + w, 0) / weighted.length;
    return weighted.reduce((s, w) => s + (w - mean) ** 2, 0);
}

export function nashScore(times: number[], weights: number[]): number {
    // Minimise sum of weight[i] * log(time[i]). Equivalent to maximising the
    // weighted geometric mean of inverse travel times. Clamp to >=1 min to
    // avoid log(0) / negative inputs.
    return times.reduce((sum, t, i) => sum + weights[i] * Math.log(Math.max(t, 1)), 0);
}
