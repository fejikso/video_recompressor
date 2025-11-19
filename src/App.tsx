import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { FileSelector } from './components/FileSelector';
import { FilterSelector } from './components/FilterSelector';
import { ModifierSelector } from './components/ModifierSelector';
import { Settings } from './components/Settings';
import { Progress } from './components/Progress';
import { VideoFilter, VideoModifier, VideoOptions, FileStatus, LogPayload } from './types';
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
    hwaccel: 'none'
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAborted, setIsAborted] = useState(false);
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [selectedFileLog, setSelectedFileLog] = useState<string | null>(null);

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
        return {
          ...file,
          processed: status === 'skipped',
          status: status === 'skipped' ? 'skipped' : 'pending'
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

    // Clear logs for files about to be processed? Or keep history?
    // Let's keep history but maybe clear if re-running same file.
    // For now, just append.

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
        await invoke('process_video', {
          inputPath: file.path,
          options: currentOptions
        });

        if (abortRef.current) {
          setFiles(prev => prev.map(f => f.path === file.path ? { ...f, status: 'aborted' } : f));
          break;
        }

        setFiles(prev => prev.map(f => f.path === file.path ? { ...f, status: 'done', processed: true } : f));
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

  return (
    <div className="container">
      <header className="flex justify-between items-center mb-6">
        <h1>Video Reprocessor</h1>
        <div className="flex gap-2">
          <a href="https://github.com/fejikso/video_recompressor" target="_blank" className="btn btn-secondary text-sm">GitHub</a>
          <a href="https://www.buymeacoffee.com/fejikso" target="_blank" className="btn btn-secondary text-sm">Support</a>
        </div>
      </header>

      <main>
        <div className="left-panel">
          <FileSelector
            files={files}
            onSelect={handleFileSelect}
            onRemove={handleRemoveFile}
            onSelectLog={(path) => setSelectedFileLog(path)}
          />
          <Settings options={options} onChange={handleOptionChange} />

          <div className="actions">
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
            fileName={selectedFileLog ? files.find(f => f.path === selectedFileLog)?.name : undefined}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
