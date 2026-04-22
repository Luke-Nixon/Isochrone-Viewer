import { Box, Button, Stack } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PersonRow from '../PersonRow/PersonRow';
import type { Person } from '../../../services/MeetingPointService';
import { nextPersonColor } from '../colors';

interface PeopleListProps {
    people: Person[];
    showWeights: boolean;
    onChange: (people: Person[]) => void;
}

const PeopleList: React.FC<PeopleListProps> = ({ people, showWeights, onChange }) => {
    const addPerson = () => {
        const used = people.map(p => p.color);
        const newPerson: Person = {
            id: crypto.randomUUID(),
            label: `Person ${people.length + 1}`,
            address: null,
            mode: 'auto',
            weight: 1.0,
            color: nextPersonColor(used),
        };
        onChange([...people, newPerson]);
    };

    const updatePerson = (id: string, next: Person) => {
        onChange(people.map(p => p.id === id ? next : p));
    };

    const removePerson = (id: string) => {
        onChange(people.filter(p => p.id !== id));
    };

    return (
        <Stack spacing={2}>
            {people.map((p) => (
                <PersonRow
                    key={p.id}
                    person={p}
                    showWeight={showWeights}
                    canRemove={people.length > 2}
                    onChange={(next) => updatePerson(p.id, next)}
                    onRemove={() => removePerson(p.id)}
                />
            ))}
            <Box>
                <Button variant="outlined" startIcon={<AddIcon />} onClick={addPerson} fullWidth>
                    Add person
                </Button>
            </Box>
        </Stack>
    );
};

export default PeopleList;
