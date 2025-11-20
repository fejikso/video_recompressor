import { useState, useMemo } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { FileStatus } from '../types';

interface CleanupModalProps {
    files: FileStatus[];
    onClose: () => void;
    onConfirm: (filesToDelete: string[]) => void;
}

export default function CleanupModal({ files, onClose, onConfirm }: CleanupModalProps) {
    const [deleteOriginals, setDeleteOriginals] = useState(false);
    const [deleteReprocessed, setDeleteReprocessed] = useState(true);

    const processedFiles = useMemo(() => files.filter(f => f.status === 'done' && f.stats), [files]);

    const filesToDelete = useMemo(() => {
        const toDelete: string[] = [];
        processedFiles.forEach(f => {
            if (!f.stats) return;

            if (deleteOriginals && f.stats.original_size > f.stats.new_size) {
                toDelete.push(f.path);
            }

            if (deleteReprocessed && f.stats.new_size > f.stats.original_size) {
                toDelete.push(f.stats.output_path);
            }
        });
        return toDelete;
    }, [processedFiles, deleteOriginals, deleteReprocessed]);

    const formatSize = (bytes: number) => {
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>Cleanup Files</h3>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4 flex gap-3 text-yellow-800">
                        <AlertTriangle size={20} className="flex-shrink-0" />
                        <p className="text-sm m-0">
                            This action will permanently delete files. Please review your selection carefully.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => setDeleteOriginals(!deleteOriginals)}>
                            <input
                                type="checkbox"
                                checked={deleteOriginals}
                                onChange={(e) => setDeleteOriginals(e.target.checked)}
                                className="mt-1"
                            />
                            <div>
                                <div className="font-medium">Delete originals larger than reprocessed</div>
                                <div className="text-sm text-gray-500">
                                    Removes the original file if the new version is smaller (saves space).
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => setDeleteReprocessed(!deleteReprocessed)}>
                            <input
                                type="checkbox"
                                checked={deleteReprocessed}
                                onChange={(e) => setDeleteReprocessed(e.target.checked)}
                                className="mt-1"
                            />
                            <div>
                                <div className="font-medium">Delete reprocessed files larger than originals</div>
                                <div className="text-sm text-gray-500">
                                    Removes the new file if it turned out larger than the original (failed optimization).
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-600">Files to delete:</span>
                            <span className="font-bold">{filesToDelete.length}</span>
                        </div>
                        {filesToDelete.length > 0 && (
                            <div className="text-xs text-gray-500 max-h-32 overflow-y-auto border-t pt-2 mt-2">
                                {filesToDelete.map((path, i) => {
                                    const file = processedFiles.find(f => f.path === path || f.stats?.output_path === path);
                                    const size = file?.stats ? (path === file.path ? file.stats.original_size : file.stats.new_size) : 0;
                                    return (
                                        <div key={i} className="truncate py-1 flex justify-between">
                                            <span className="truncate mr-2">{path}</span>
                                            <span className="flex-shrink-0">{formatSize(size)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        className="danger-btn flex items-center gap-2"
                        onClick={() => onConfirm(filesToDelete)}
                        disabled={filesToDelete.length === 0}
                    >
                        <Trash2 size={16} />
                        Delete {filesToDelete.length} Files
                    </button>
                </div>
            </div>
        </div>
    );
}
