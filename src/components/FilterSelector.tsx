import React from 'react';
import { VideoFilter } from '../types';
import { Filter } from 'lucide-react';

interface Props {
    filters: VideoFilter[];
    selected: string[];
    onChange: (selected: string[]) => void;
}

export const FilterSelector: React.FC<Props> = ({ filters, selected, onChange }) => {
    // Sort filters by priority
    const sortedFilters = [...filters].sort((a, b) => b.priority - a.priority);

    const handleToggle = (shortName: string) => {
        if (selected.includes(shortName)) {
            onChange(selected.filter(s => s !== shortName));
        } else {
            onChange([...selected, shortName]);
        }
    };

    return (
        <div className="card">
            <div className="flex items-center gap-2 mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Filter size={20} className="text-accent" style={{ color: 'var(--accent-primary)' }} />
                <h2>Filters</h2>
            </div>

            <div className="grid grid-cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {sortedFilters.map((filter) => (
                    <div
                        key={filter.short_name}
                        className={`checkbox-item ${selected.includes(filter.short_name) ? 'bg-accent/10' : ''}`}
                        onClick={() => handleToggle(filter.short_name)}
                        style={{
                            backgroundColor: selected.includes(filter.short_name) ? 'rgba(51, 154, 240, 0.1)' : 'transparent',
                            border: selected.includes(filter.short_name) ? '1px solid var(--accent-primary)' : '1px solid transparent'
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={selected.includes(filter.short_name)}
                            onChange={() => { }} // Handled by parent div click
                        />
                        <div>
                            <div className="font-medium">{filter.long_name}</div>
                            <div className="text-xs text-secondary" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{filter.short_name}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
