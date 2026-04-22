import { nashScore } from '../shared/scoring';
import { solveByCandidateScore } from '../shared/solveByCandidateScore';
import type { Person, PersonBands, MeetingResult, MeetingOptions } from '../types';

export function solveNash(people: Person[], personBands: PersonBands[], options: MeetingOptions): MeetingResult {
    return solveByCandidateScore(people, personBands, options, nashScore);
}
