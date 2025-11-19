import React from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { FileVideo, Trash2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { FileStatus } from '../types';

interface Props {
    files: FileStatus[];
    onSelect: (files: FileStatus[]) => void;
    onRemove: (path: string) => void;
    onSelectLog: (path: string) => void;
}

export const FileSelector: React.FC<Props> = ({ files, onSelect, onRemove, onSelectLog }) => {
    const handleSelectFiles = async () => {
        try {
            const selected = await open({
                multiple: true,
                filters: [{
                    name: 'Video',
                    extensions: ['mp4', 'mov', 'm4v', 'avi']
                }]
            });

            if (selected) {
                const paths = Array.isArray(selected) ? selected : [selected];
                // We'll need to check status for these files in the parent component
                const newFiles: FileStatus[] = paths.map(path => ({
                    path,
                    name: path.split('/').pop() || path,
                    processed: false, // Will be updated by parent
                    status: 'pending'
                }));
                onSelect(newFiles);
            }
        } catch (err) {
            console.error('Failed to open file dialog:', err);
        }
    };

    return (
        <div className="card">
            <div className="flex justify-between items-center mb-4" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2>Input Files</h2>
                <button className="btn btn-primary" onClick={handleSelectFiles}>
                    <FileVideo size={18} />
                    Add Videos
                </button>
            </div>

            {files.length === 0 ? (
                <div className="text-center p-8 text-secondary" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', border: '2px dashed var(--border-color)', borderRadius: '8px' }}>
                    No files selected. Click "Add Videos" to begin.
                </div>
            ) : (
                <div className="scroll-area">
                    {files.map((file) => (
                        <div key={file.path} className="flex items-center justify-between p-3 mb-2 bg-tertiary rounded" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', marginBottom: '0.5rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                            <div className="flex items-center gap-3" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <FileVideo size={20} className="text-accent" style={{ color: 'var(--accent-primary)' }} />
                                <div>
                                    <div className="font-medium">{file.name}</div>
                                    <div className="text-sm text-secondary" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{file.path}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {file.processed && (
                                    <span className="badge badge-warning" title="Already processed">
                                        Processed
                                    </span>
                                )}

                                <div className="cursor-pointer" onClick={() => onSelectLog(file.path)} title="View Log">
                                    {file.status === 'done' && <CheckCircle size={18} className="text-success" style={{ color: 'var(--success)' }} />}
                                    {file.status === 'error' && <AlertCircle size={18} className="text-error" style={{ color: 'var(--error)' }} />}
                                    {file.status === 'processing' && <Clock size={18} className="text-accent animate-spin" style={{ color: 'var(--accent-primary)' }} />}
                                    {file.status === 'skipped' && <span className="badge badge-info">Skipped</span>}
                                    {file.status === 'pending' && <span className="text-secondary text-sm">Pending</span>}
                                </div>

                                <button
                                    className="btn p-1 hover:bg-error/10 hover:text-error"
                                    onClick={() => onRemove(file.path)}
                                    style={{ padding: '0.25rem', background: 'transparent', color: 'var(--text-secondary)' }}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
