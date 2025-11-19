import React from 'react';
import { VideoModifier } from '../types';
import { Wand2 } from 'lucide-react';

interface Props {
    modifiers: VideoModifier[];
    selected: [string, string][]; // [short_name, value]
    onChange: (selected: [string, string][]) => void;
}

export const ModifierSelector: React.FC<Props> = ({ modifiers, selected, onChange }) => {
    const isSelected = (shortName: string) => selected.some(([name]) => name === shortName);
    const getValue = (shortName: string) => {
        const found = selected.find(([name]) => name === shortName);
        return found ? found[1] : '';
    };

    const handleToggle = (modifier: VideoModifier) => {
        if (isSelected(modifier.short_name)) {
            onChange(selected.filter(([name]) => name !== modifier.short_name));
        } else {
            // Default value logic could be improved, but for now empty or default
            const defaultValue = modifier.code.includes('#1') ? '60' : '';
            onChange([...selected, [modifier.short_name, defaultValue]]);
        }
    };

    const handleValueChange = (shortName: string, newValue: string) => {
        onChange(selected.map(([name, val]) =>
            name === shortName ? [name, newValue] : [name, val]
        ));
    };

    return (
        <div className="card">
            <div className="flex items-center gap-2 mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Wand2 size={20} className="text-accent" style={{ color: 'var(--accent-primary)' }} />
                <h2>Modifiers</h2>
            </div>

            <div className="grid" style={{ display: 'grid', gap: '1rem' }}>
                {modifiers.map((modifier) => {
                    const selected = isSelected(modifier.short_name);
                    const needsParam = modifier.code.includes('#1');

                    return (
                        <div
                            key={modifier.short_name}
                            className="flex items-center justify-between p-2 rounded hover:bg-tertiary"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.5rem',
                                borderRadius: '6px',
                                backgroundColor: selected ? 'rgba(51, 154, 240, 0.05)' : 'transparent'
                            }}
                        >
                            <div
                                className="flex items-center gap-3 cursor-pointer flex-1"
                                onClick={() => handleToggle(modifier)}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, cursor: 'pointer' }}
                            >
                                <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() => { }}
                                    style={{ accentColor: 'var(--accent-primary)', width: '1.1rem', height: '1.1rem' }}
                                />
                                <div>
                                    <div className="font-medium">{modifier.long_name}</div>
                                    <div className="text-xs text-secondary" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{modifier.code}</div>
                                </div>
                            </div>

                            {selected && needsParam && (
                                <div className="w-32" style={{ width: '120px' }}>
                                    <input
                                        type="text"
                                        className="input"
                                        value={getValue(modifier.short_name)}
                                        onChange={(e) => handleValueChange(modifier.short_name, e.target.value)}
                                        placeholder="Value"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
