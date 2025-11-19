import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { FileSelector } from './components/FileSelector';
import { FilterSelector } from './components/FilterSelector';
import { ModifierSelector } from './components/ModifierSelector';
import { Settings } from './components/Settings';
import { Progress } from './components/Progress';
import { VideoFilter, VideoModifier, VideoOptions, FileStatus } from './types';
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
  const [logs, setLogs] = useState<string[]>([]);

  const abortRef = useRef(false);

  useEffect(() => {
    const unlisten = listen<string>('processing-log', (event) => {
      setLogs((prev) => [...prev, event.payload]);
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
        const processed = await invoke<boolean>('check_file_status', { path: file.path });
        return { ...file, processed };
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
    setLogs([]);

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
        setLogs(prev => [...prev, `Processing aborted before starting ${file.name}.`]);
        break;
      }
      if (file.status === 'done') {
        setLogs(prev => [...prev, `Skipping already processed file: ${file.name}`]);
        continue;
      }

      setFiles(prev => prev.map(f => f.path === file.path ? { ...f, status: 'processing' } : f));
      setLogs(prev => [...prev, `Processing: ${file.name}`]);

      try {
        await invoke('process_video', {
          inputPath: file.path,
          options: currentOptions
        });

        if (abortRef.current) {
          setFiles(prev => prev.map(f => f.path === file.path ? { ...f, status: 'aborted' } : f));
          setLogs(prev => [...prev, `Processing of ${file.name} aborted.`]);
          break;
        }

        setFiles(prev => prev.map(f => f.path === file.path ? { ...f, status: 'done', processed: true } : f));
        setLogs(prev => [...prev, `✓ Finished: ${file.name}`]);
      } catch (err) {
        console.error('Processing failed:', err);

        if (abortRef.current) {
          setFiles(prev => prev.map(f => f.path === file.path ? { ...f, status: 'aborted' } : f));
          setLogs(prev => [...prev, `Processing of ${file.name} aborted.`]);
          break;
        } else {
          setFiles(prev => prev.map(f => f.path === file.path ? { ...f, status: 'error', error: String(err) } : f));
          setLogs(prev => [...prev, `❌ Failed: ${file.name} - ${err}`]);
        }
      }
    }

    if (abortRef.current) {
      setLogs(prev => [...prev, 'All tasks aborted.']);
    } else {
      setLogs(prev => [...prev, 'All tasks completed.']);
    }
    setIsProcessing(false);
  };

  const handleAbort = async () => {
    abortRef.current = true;
    setIsAborted(true);
    setLogs(prev => [...prev, 'Attempting to abort current processing...']);
    try {
      await invoke('cancel_processing');
    } catch (err) {
      console.error('Failed to send abort signal:', err);
      setLogs(prev => [...prev, `Error sending abort signal: ${err}`]);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>Video Reprocessor</h1>
      </header>

      <main>
        <div className="left-panel">
          <FileSelector
            files={files}
            onSelect={handleFileSelect}
            onRemove={handleRemoveFile}
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
          <Progress logs={logs} />
        </div>
      </main>
    </div>
  );
}

export default App;
