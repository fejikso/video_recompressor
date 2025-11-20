import React, { useState } from 'react';
import { open, ask } from '@tauri-apps/plugin-dialog';
import { Upload, X, FileVideo, CheckCircle, AlertCircle, Clock, FolderOpen, Trash2, ThumbsDown, Play, FileText, Image as ImageIcon } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { FileStatus } from '../types';

interface FileSelectorProps {
    files: FileStatus[];
    onSelect: (files: FileStatus[]) => void;
    onRemove: (path: string) => void;
    onSelectLog: (path: string) => void;
    onCleanup: () => void;
    onReject: (path: string) => void;
    showCleanup: boolean;
    onClear: () => void;
}

export function FileSelector({ files, onSelect, onRemove, onSelectLog, onCleanup, onReject, showCleanup, onClear }: FileSelectorProps) {
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);

    const handleOpen = async () => {
        const selected = await open({
            multiple: true,
            filters: [{
                name: 'Video',
                extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm']
            }]
        });

        if (selected) {
            const newFiles = (Array.isArray(selected) ? selected : [selected]).map(path => ({
                path,
                name: path.split(/[\\/]/).pop() || path,
                status: 'pending' as const,
                processed: false
            }));
            onSelect(newFiles);
        }
    };

    const handleClearList = async () => {
        if (files.length === 0) return;

        const confirmed = await ask('Are you sure you want to clear the file list?', {
            title: 'Video Reprocessor',
            kind: 'warning'
        });

        if (confirmed) {
            onClear();
        }
    };

    const handleShowInFolder = async (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        try {
            await invoke('show_in_folder', { path });
        } catch (err) {
            console.error('Failed to open folder:', err);
        }
    };

    const handleOpenFile = async (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        try {
            await invoke('open_file', { path });
        } catch (err) {
            console.error('Failed to open file:', err);
        }
    };

    const handleSnapshot = async (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        setIsPreviewLoading(true);
        try {
            const base64Image = await invoke<string>('generate_preview', { path });
            setPreviewImage(base64Image);
        } catch (err) {
            console.error('Failed to generate preview:', err);
            await ask(`Failed to generate preview: ${err}`, { title: 'Error', kind: 'error' });
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="card h-full flex flex-col" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="flex justify-between items-center mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div className="flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileVideo size={20} className="text-accent" style={{ color: 'var(--accent-primary)' }} />
                    <h2>Input Files ({files.length})</h2>
                </div>
                <div className="flex gap-2">
                    {files.length > 0 && (
                        <button
                            className="btn btn-secondary text-sm"
                            onClick={handleClearList}
                            title="Clear List"
                        >
                            <Trash2 size={16} />
                            Clear
                        </button>
                    )}
                    {showCleanup && (
                        <button
                            className="btn btn-secondary text-sm"
                            onClick={onCleanup}
                            title="Cleanup larger files"
                        >
                            <Trash2 size={16} />
                            Cleanup
                        </button>
                    )}
                    <button className="btn btn-primary text-sm" onClick={handleOpen}>
                        <Upload size={16} />
                        Add Files
                    </button>
                </div>
            </div>

            <div className="file-list scroll-area" style={{
                flex: 1,
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-tertiary)'
            }}>
                {files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-secondary p-8" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', padding: '2rem' }}>
                        <Upload size={48} className="mb-4 opacity-50" style={{ marginBottom: '1rem', opacity: 0.5 }} />
                        <p>Drag & drop videos here</p>
                        <p className="text-sm">or click Add Files</p>
                    </div>
                ) : (
                    files.map((file) => (
                        <div
                            key={file.path}
                            className="file-item p-3 border-b border-border hover:bg-secondary/50 transition-colors"
                            style={{
                                padding: '0.75rem',
                                borderBottom: '1px solid var(--border-color)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem'
                            }}
                        >
                            {/* Input File Row */}
                            <div className="flex items-center gap-3" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <button
                                    className="icon-btn text-accent hover:text-accent-hover"
                                    onClick={(e) => handleOpenFile(e, file.path)}
                                    title="Open Input Video"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
                                >
                                    <Play size={20} fill="currentColor" />
                                </button>

                                <div className="flex-1 min-w-0" style={{ flex: 1, minWidth: 0 }}>
                                    <div className="font-medium truncate" title={file.path} style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        <span className="text-secondary mr-1" style={{ color: 'var(--text-secondary)', fontSize: '0.8em' }}>Input:</span>
                                        {file.name}
                                    </div>
                                    <div className="text-xs text-secondary flex items-center gap-2" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                        <span className={`status-badge status-${file.status}`} onClick={() => onSelectLog(file.path)} style={{ cursor: 'pointer' }}>
                                            {file.status === 'done' && <CheckCircle size={12} />}
                                            {file.status === 'processing' && <Clock size={12} className="animate-spin" />}
                                            {file.status === 'error' && <AlertCircle size={12} />}
                                            {file.status.toUpperCase()}
                                        </span>
                                        <span className="truncate opacity-50" title={file.path}>{file.path}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        className="icon-btn text-secondary hover:text-primary"
                                        onClick={(e) => handleSnapshot(e, file.path)}
                                        title="Preview Snapshot"
                                        disabled={isPreviewLoading}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                    >
                                        <ImageIcon size={16} />
                                    </button>
                                    <button
                                        className="icon-btn text-secondary hover:text-primary"
                                        onClick={(e) => handleShowInFolder(e, file.path)}
                                        title="Show Input in Folder"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                    >
                                        <FolderOpen size={16} />
                                    </button>
                                    <button
                                        className="icon-btn text-secondary hover:text-danger"
                                        onClick={() => onRemove(file.path)}
                                        title="Remove"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Output File Row (if processed) */}
                            {file.status === 'done' && file.stats && (
                                <div className="bg-secondary/30 p-2 rounded text-xs mt-1 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-primary)', padding: '0.5rem', borderRadius: '4px', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <button
                                        className="icon-btn text-success hover:text-success"
                                        onClick={(e) => handleOpenFile(e, file.stats!.output_path)}
                                        title="Open Output Video"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: 'var(--success)' }}
                                    >
                                        <Play size={20} fill="currentColor" />
                                    </button>

                                    <div className="flex-1 min-w-0" style={{ flex: 1, minWidth: 0 }}>
                                        <div className="font-medium truncate text-accent" title={file.stats.output_path} style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--accent-primary)' }}>
                                            <span className="text-secondary mr-1" style={{ color: 'var(--text-secondary)', fontSize: '0.8em' }}>Output:</span>
                                            {file.stats.output_path.split(/[\\/]/).pop()}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            <span>{formatSize(file.stats.original_size)} → {formatSize(file.stats.new_size)}</span>
                                            <span style={{
                                                color: (file.stats.new_size - file.stats.original_size) <= 0 ? 'var(--success)' : 'var(--error)',
                                                fontWeight: 600
                                            }}>
                                                ({((file.stats.new_size - file.stats.original_size) / file.stats.original_size * 100).toFixed(1)}%)
                                            </span>
                                            <span>; {file.stats.duration_secs.toFixed(1)}s</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 items-center">
                                        <button
                                            className="icon-btn text-secondary hover:text-primary"
                                            onClick={(e) => handleShowInFolder(e, file.stats!.output_path)}
                                            title="Show Output in Folder"
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                        >
                                            <FolderOpen size={16} />
                                        </button>
                                        <button
                                            className="icon-btn text-secondary hover:text-primary"
                                            onClick={() => onSelectLog(file.path)}
                                            title="View Processing Log"
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                        >
                                            <FileText size={16} />
                                        </button>
                                        <button
                                            className="icon-btn text-secondary hover:text-danger"
                                            onClick={() => onReject(file.path)}
                                            title="Reject (Delete Output)"
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                        >
                                            <ThumbsDown size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Preview Modal */}
            {previewImage && (
                <div className="modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div className="modal-content" style={{
                        backgroundColor: 'var(--bg-secondary)', padding: '1rem',
                        borderRadius: '8px', maxWidth: '90%', maxHeight: '90%',
                        display: 'flex', flexDirection: 'column', gap: '1rem'
                    }}>
                        <div className="flex justify-between items-center">
                            <h3>Snapshot Preview</h3>
                            <button onClick={() => setPreviewImage(null)} className="icon-btn">
                                <X size={24} />
                            </button>
                        </div>
                        <img src={previewImage} alt="Preview" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
                    </div>
                </div>
            )}
        </div>
    );
}
