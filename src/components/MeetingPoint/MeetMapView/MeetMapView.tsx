import { useMemo } from 'react';
import MapView from '../../MapView/MapView';
import type { MapFocus, MapMarkerSpec, MapPolygonSpec } from '../../MapView/MapView';
import type { Person, MeetingResult } from '../../../services/MeetingPointService';
import { INTERSECTION_COLOR, MEETING_POINT_COLOR } from '../colors';

const ALTERNATE_COLOR = '#ffd166';

interface MeetMapViewProps {
    people: Person[];
    result: MeetingResult | null;
    selectedIndex: number;
    onSelectIndex: (index: number) => void;
}

const MeetMapView: React.FC<MeetMapViewProps> = ({ people, result, selectedIndex, onSelectIndex }) => {
    const markers: MapMarkerSpec[] = useMemo(() => {
        const out: MapMarkerSpec[] = [];

        for (const p of people) {
            if (!p.address) continue;
            out.push({
                id: `person-${p.id}`,
                position: [p.address.lat, p.address.lng],
                color: p.color,
                radius: 9,
                label: p.label,
            });
        }

        if (result) {
            result.alternates.forEach((alt, i) => {
                const isSelected = selectedIndex === i;
                out.push({
                    id: `alt-${i}`,
                    position: [alt.point[1], alt.point[0]],
                    color: ALTERNATE_COLOR,
                    radius: isSelected ? 9 : 6,
                    weight: isSelected ? 3 : 1.5,
                    fillOpacity: isSelected ? 1 : 0.7,
                    label: `Alternate ${i + 1} — click to inspect`,
                    onClick: () => onSelectIndex(i),
                });
            });

            out.push({
                id: 'primary',
                position: [result.primary.point[1], result.primary.point[0]],
                color: MEETING_POINT_COLOR,
                radius: selectedIndex < 0 ? 12 : 9,
                weight: selectedIndex < 0 ? 3 : 2,
                label: result.alternates.length > 0 ? 'Best' : 'Meeting point',
                labelPermanent: selectedIndex < 0,
                onClick: () => onSelectIndex(-1),
            });
        }

        return out;
    }, [people, result, selectedIndex, onSelectIndex]);

    const polygons: MapPolygonSpec[] = useMemo(() => {
        if (!result?.intersection) return [];
        return [{
            id: `intersection-${JSON.stringify(result.primary.point)}`,
            data: result.intersection,
            color: INTERSECTION_COLOR,
            fillOpacity: 0.18,
            weight: 2,
        }];
    }, [result]);

    const focus: MapFocus | undefined = useMemo(() => {
        const points: [number, number][] = [];
        for (const p of people) if (p.address) points.push([p.address.lat, p.address.lng]);
        if (result) points.push([result.primary.point[1], result.primary.point[0]]);
        return points.length > 0 ? { points } : undefined;
    }, [people, result]);

    return <MapView markers={markers} polygons={polygons} focus={focus} />;
};

export default MeetMapView;
