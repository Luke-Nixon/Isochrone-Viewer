import { varianceScore } from '../shared/scoring';
import { solveByCandidateScore } from '../shared/solveByCandidateScore';
import type { Person, PersonBands, MeetingResult, MeetingOptions } from '../types';

export function solveMinVariance(people: Person[], personBands: PersonBands[], options: MeetingOptions): MeetingResult {
    return solveByCandidateScore(people, personBands, options, varianceScore);
}
