import { useEffect, useRef } from 'react';
import { ProcessingStats } from '../types';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { Download } from 'lucide-react';

interface ProgressProps {
    logs: string[];
    status?: string;
    fileName?: string;
    onCloseLog?: () => void;
    stats?: ProcessingStats;
}

export function Progress({ logs, status = 'Idle', fileName, onCloseLog }: ProgressProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const handleExportLog = async () => {
        if (!logs.length || !fileName) return;

        try {
            const defaultPath = `${fileName.split('.')[0]}_log.txt`;
            const filePath = await save({
                defaultPath,
                filters: [{
                    name: 'Text File',
                    extensions: ['txt']
                }]
            });

            if (filePath) {
                await invoke('save_text_file', {
                    path: filePath,
                    content: logs.join('\n')
                });
            }
        } catch (err) {
            console.error('Failed to save log:', err);
        }
    };

    return (
        <div className="progress-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0' }}>
                <h3 style={{ margin: 0 }}>
                    {status} {fileName && `- ${fileName}`}
                </h3>
                <div className="flex gap-2">
                    {logs.length > 0 && (
                        <button className="btn btn-secondary text-sm flex items-center gap-1" onClick={handleExportLog} title="Export Log to Text File">
                            <Download size={14} />
                            Export
                        </button>
                    )}
                    {onCloseLog && (
                        <button className="btn btn-secondary text-sm" onClick={onCloseLog}>Close Log</button>
                    )}
                </div>
            </div>

            <div className="logs-container scroll-area" ref={scrollRef} style={{
                flex: 1,
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '8px',
                padding: '1rem',
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                whiteSpace: 'pre-wrap'
            }}>
                {logs.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>
                        Ready to process...
                    </div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} style={{ marginBottom: '0.25rem' }}>{log}</div>
                    ))
                )}
            </div>
        </div>
    );
}

export default Progress;
