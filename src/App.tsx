import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Github, Coffee, HelpCircle } from "lucide-react";
import { FileSelector } from './components/FileSelector';
import { FilterSelector } from './components/FilterSelector';
import { ModifierSelector } from './components/ModifierSelector';
import Settings from './components/Settings';
import { Progress } from './components/Progress';
import HelpModal from './components/HelpModal';
import CleanupModal from './components/CleanupModal';
import { VideoFilter, VideoModifier, VideoOptions, FileStatus, LogPayload, ProcessingStats } from './types';
import './App.css';

function App() {
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [filters, setFilters] = useState<VideoFilter[]>([]);
  const [modifiers, setModifiers] = useState<VideoModifier[]>([]);
  const [options, setOptions] = useState<VideoOptions>({
    filters: [],
    modifiers: [],
    quality: 23,
    preset: 'medium',
    codec: 'libx264',
    hwaccel: 'none',
    tag_original: false,
    stabilize: false,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAborted, setIsAborted] = useState(false);
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [selectedFileLog, setSelectedFileLog] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showCleanup, setShowCleanup] = useState(false);

  const abortRef = useRef(false);

  useEffect(() => {
    const unlisten = listen<LogPayload>('processing-log', (event) => {
      setLogs((prev) => {
        const fileLogs = prev[event.payload.path] || [];
        return { ...prev, [event.payload.path]: [...fileLogs, event.payload.message] };
      });
    });

    invoke<VideoFilter[]>('get_filters').then(setFilters);
    invoke<VideoModifier[]>('get_modifiers').then(setModifiers);

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const handleFileSelect = async (newFiles: FileStatus[]) => {
    // Check status for each file
    const checkedFiles = await Promise.all(newFiles.map(async (file) => {
      try {
        const status = await invoke<string>('check_file_status', { path: file.path });

        let finalStatus = status === 'skipped' ? 'skipped' : 'pending';
        let processed = status === 'skipped';

        if (status === 'skipped') {
          const confirmed = await confirm(`This video has been previously reprocessed.\nAre you sure you want to reprocess it again?\n\n${file.name}`);
          if (confirmed) {
            finalStatus = 'pending';
            processed = false;
          }
        }

        return {
          ...file,
          processed: processed,
          status: finalStatus
        } as FileStatus;
      } catch (err) {
        console.error('Failed to check status:', err);
        return file;
      }
    }));

    setFiles(prev => {
      const existingPaths = new Set(prev.map(f => f.path));
      const uniqueNewFiles = checkedFiles.filter(f => !existingPaths.has(f.path));
      return [...prev, ...uniqueNewFiles];
    });
  };

  const handleRemoveFile = (path: string) => {
    setFiles(prev => prev.filter(f => f.path !== path));
    setLogs(prev => {
      const newLogs = { ...prev };
      delete newLogs[path];
      return newLogs;
    });
    if (selectedFileLog === path) setSelectedFileLog(null);
  };

  const handleFilterChange = (selected: string[]) => {
    setOptions(prev => ({ ...prev, filters: selected }));
  };

  const handleModifierChange = (selected: [string, string][]) => {
    setOptions(prev => ({ ...prev, modifiers: selected }));
  };

  const handleOptionChange = (newOptions: Partial<VideoOptions>) => {
    setOptions(prev => ({ ...prev, ...newOptions }));
  };

  const startProcessing = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setIsAborted(false);
    abortRef.current = false;

    const currentOptions: VideoOptions = {
      ...options,
      modifiers: options.modifiers
    };

    // Reset status for pending files
    setFiles(prev => prev.map(f =>
      f.status === 'error' || f.status === 'done' || f.status === 'aborted' ? { ...f, status: 'pending' } : f
    ));

    for (const file of files) {
      if (abortRef.current) {
        break;
      }
      if (file.status === 'done' || file.status === 'skipped') {
        continue;
      }

      setFiles(prev => prev.map(f => f.path === file.path ? { ...f, status: 'processing' } : f));
      setSelectedFileLog(file.path); // Auto-select log for current file

      try {
        const stats = await invoke<ProcessingStats>('process_video', {
          inputPath: file.path,
          options: currentOptions
        });

        if (abortRef.current) {
          setFiles(prev => prev.map(f => f.path === file.path ? { ...f, status: 'aborted' } : f));
          break;
        }

        setFiles(prev => prev.map(f => f.path === file.path ? { ...f, status: 'done', processed: true, stats } : f));
      } catch (err) {
        console.error('Processing failed:', err);

        if (abortRef.current) {
          setFiles(prev => prev.map(f => f.path === file.path ? { ...f, status: 'aborted' } : f));
          break;
        } else {
          setFiles(prev => prev.map(f => f.path === file.path ? { ...f, status: 'error', error: String(err) } : f));
        }
      }
    }

    setIsProcessing(false);
  };

  const handleAbort = async () => {
    abortRef.current = true;
    setIsAborted(true);
    try {
      await invoke('cancel_processing');
    } catch (err) {
      console.error('Failed to send abort signal:', err);
    }
  };

  const handleCleanupConfirm = async (filesToDelete: string[]) => {
    for (const path of filesToDelete) {
      try {
        await invoke('delete_file', { path });
        // If we deleted the original, we might want to update the UI to reflect that?
        // Or if we deleted the reprocessed file, we should update status.
        // For simplicity, let's just remove the file from the list if it was the input file.
        // If it was the output file, we might want to mark it as not processed?

        // Actually, let's just remove it from the list if it's the input file.
        setFiles(prev => {
          // Check if 'path' matches any input file path
          const isInput = prev.some(f => f.path === path);
          if (isInput) {
            return prev.filter(f => f.path !== path);
          }
          // If it's an output file, we should probably update the stats/status
          return prev.map(f => {
            if (f.stats?.output_path === path) {
              return { ...f, status: 'pending', processed: false, stats: undefined };
            }
            return f;
          });
        });

      } catch (err) {
        console.error(`Failed to delete ${path}:`, err);
      }
    }
    setShowCleanup(false);
  };


  const handleReject = async (path: string) => {
    const file = files.find(f => f.path === path);
    if (file && file.stats) {
      if (await confirm(`Are you sure you want to delete the reprocessed file?\n${file.stats.output_path}`)) {
        try {
          await invoke('delete_file', { path: file.stats.output_path });
          setFiles(prev => prev.map(f => f.path === path ? { ...f, status: 'pending', processed: false, stats: undefined } : f));
        } catch (e) {
          console.error("Failed to delete:", e);
        }
      }
    }
  };

  const hasProcessedFiles = files.some(f => f.status === 'done' && f.stats);

  return (
    <div className="container">
      <header className="flex justify-between items-center mb-6">
        <h1>Video Reprocessor</h1>
        <div className="flex gap-2">
          <button className="btn btn-secondary text-sm" onClick={() => setShowHelp(true)}>
            <HelpCircle size={16} />
            Help
          </button>
          <a href="https://github.com/fejikso/video_recompressor" target="_blank" className="btn btn-secondary text-sm">
            <Github size={16} />
            Homepage
          </a>
          <a href="https://www.buymeacoffee.com/fejikso" target="_blank" className="btn btn-secondary text-sm">
            <Coffee size={16} />
            Support the author
          </a>
        </div>
      </header>

      <main>
        <div className="left-panel">
          <FileSelector
            files={files}
            onSelect={handleFileSelect}
            onRemove={handleRemoveFile}
            onSelectLog={(path) => setSelectedFileLog(path)}
            onCleanup={() => setShowCleanup(true)}
            onReject={handleReject}
            showCleanup={hasProcessedFiles}
            onClear={() => setFiles([])}
          />
          <Settings options={options} onChange={handleOptionChange} processing={isProcessing} />

          <div className="actions" style={{ display: 'flex', gap: '1rem' }}>
            {!isProcessing ? (
              <button
                className="primary-btn"
                onClick={startProcessing}
                disabled={files.length === 0}
              >
                Start Processing
              </button>
            ) : (
              <button
                className="danger-btn"
                onClick={handleAbort}
                disabled={isAborted}
              >
                {isAborted ? 'Aborting...' : 'Abort'}
              </button>
            )}
          </div>
        </div>

        <div className="right-panel">
          <div className="selectors">
            <FilterSelector
              filters={filters}
              selected={options.filters}
              onChange={handleFilterChange}
            />
            <ModifierSelector
              modifiers={modifiers}
              selected={options.modifiers}
              onChange={handleModifierChange}
            />
          </div>
          <Progress
            logs={selectedFileLog ? (logs[selectedFileLog] || []) : []}
            status={selectedFileLog ? 'Viewing Log' : (isProcessing ? 'Processing' : 'Idle')}
            fileName={selectedFileLog ? files.find(f => f.path === selectedFileLog)?.name : undefined}
            onCloseLog={() => setSelectedFileLog(null)}
          />
        </div>
      </main>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showCleanup && (
        <CleanupModal
          files={files}
          onClose={() => setShowCleanup(false)}
          onConfirm={handleCleanupConfirm}
        />
      )}
    </div>
  );
}

export default App;
