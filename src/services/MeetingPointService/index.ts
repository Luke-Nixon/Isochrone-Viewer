import { valhallaProvider } from './provider';
import { solveMinimax } from './algorithms/minimax';
import { solveLeximin } from './algorithms/leximin';
import { solveUtilitarian } from './algorithms/utilitarian';
import { solveMinVariance } from './algorithms/minVariance';
import { solveNash } from './algorithms/nash';
import { solvePareto } from './algorithms/pareto';
import { MeetingPointError } from './types';
import type { Person, MeetingOptions, MeetingResult, PersonBands } from './types';

export * from './types';
export { clearBandCache } from './provider';

// Build the contour ladder. Fine-grained at the low end (where precision matters
// most for the algorithms), coarser at the upper end — large isochrones (>60 min)
// are expensive to compute on the public OSM Valhalla instance, often timing out.
export function buildBandLadder(maxMinutes: number, stepMinutes: number): number[] {
    const out: number[] = [];
    const fineUpper = Math.min(60, maxMinutes);
    for (let t = stepMinutes; t <= fineUpper; t += stepMinutes) out.push(t);
    if (maxMinutes > 60) {
        const COARSE_STEP = 15;
        for (let t = 60 + COARSE_STEP; t < maxMinutes; t += COARSE_STEP) out.push(t);
        if (out[out.length - 1] !== maxMinutes) out.push(maxMinutes);
    }
    return out;
}

export async function solve(people: Person[], options: MeetingOptions): Promise<MeetingResult> {
    const valid = people.filter(p => p.address !== null);
    if (valid.length < 2) {
        throw new MeetingPointError(
            'Add at least two people with valid addresses.',
            'too_few_people',
        );
    }

    const minutes = buildBandLadder(options.maxMinutes, options.bandStepMinutes);

    const personBands: PersonBands[] = [];
    for (let i = 0; i < valid.length; i++) {
        const person = valid[i];
        options.onProgress?.({
            phase: 'fetching',
            personIndex: i,
            personLabel: person.label,
            total: valid.length,
        });
        try {
            const bands = await valhallaProvider.getBands(
                person.address!,
                person.mode,
                minutes,
                (notice) => options.onProgress?.({
                    phase: 'retrying',
                    personIndex: i,
                    personLabel: person.label,
                    total: valid.length,
                    retryReason: notice.reason,
                    retryAttempt: notice.attempt,
                    retryMax: notice.maxAttempts,
                }),
            );
            personBands.push({ personId: person.id, bands });
        } catch (e) {
            if (e instanceof MeetingPointError) throw e;
            throw new MeetingPointError(
                `Failed to fetch isochrones for ${person.label}: ${e instanceof Error ? e.message : 'unknown error'}. The public OSM Valhalla often times out on large isochrones — try a smaller max travel time or wait a moment and retry.`,
                'fetch_failed',
            );
        }
    }

    options.onProgress?.({ phase: 'computing' });

    let result: MeetingResult;
    switch (options.mode) {
        case 'minimax':     result = solveMinimax(valid, personBands, options); break;
        case 'leximin':     result = solveLeximin(valid, personBands, options); break;
        case 'utilitarian': result = solveUtilitarian(valid, personBands, options); break;
        case 'minVariance': result = solveMinVariance(valid, personBands, options); break;
        case 'nash':        result = solveNash(valid, personBands, options); break;
        case 'pareto':      result = solvePareto(valid, personBands, options); break;
    }

    // If the server dropped contours (graceful fallback in provider), surface
    // a coverage notice so the user understands why the result might not match
    // their requested max travel time.
    const actualMax = Math.min(...personBands.map(pb => pb.bands[pb.bands.length - 1]?.minutes ?? 0));
    if (actualMax > 0 && actualMax < options.maxMinutes) {
        const personsAtMax = personBands.filter(pb => (pb.bands[pb.bands.length - 1]?.minutes ?? 0) < options.maxMinutes);
        const labels = personsAtMax.map(pb => valid.find(p => p.id === pb.personId)?.label ?? pb.personId).join(', ');
        result.coverageNotice = `Server dropped some large contours — coverage capped at ${actualMax} min (you requested ${options.maxMinutes}). Affected: ${labels}.`;
    }

    return result;
}
