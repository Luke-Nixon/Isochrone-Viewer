import type { Person } from '../types';

export function effectiveWeights(people: Person[], useWeights: boolean): number[] {
    return people.map(p => useWeights ? p.weight : 1.0);
}
