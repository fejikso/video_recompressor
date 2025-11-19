import React, { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';

interface Props {
    logs: string[];
    fileName?: string;
}

export const Progress: React.FC<Props> = ({ logs, fileName }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    if (logs.length === 0) return null;

    return (
        <div className="card">
            <div className="flex items-center gap-2 mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Terminal size={20} className="text-accent" style={{ color: 'var(--accent-primary)' }} />
                <h2>Processing Log {fileName ? `- ${fileName}` : ''}</h2>
            </div>

            <div
                ref={scrollRef}
                className="bg-black p-4 rounded font-mono text-sm h-64 overflow-y-auto"
                style={{
                    backgroundColor: '#000',
                    padding: '1rem',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    height: '16rem',
                    overflowY: 'auto',
                    color: '#0f0'
                }}
            >
                {logs.map((log, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {log}
                    </div>
                ))}
            </div>
        </div>
    );
};
