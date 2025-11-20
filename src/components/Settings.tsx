import { Settings as SettingsIcon, Info } from 'lucide-react';
import { VideoOptions } from "../types";

interface SettingsProps {
    options: VideoOptions;
    onChange: (options: VideoOptions) => void;
    processing: boolean;
}

export default function Settings({ options, onChange, processing }: SettingsProps) {
    const handleChange = (key: keyof VideoOptions, value: any) => {
        onChange({ ...options, [key]: value });
    };

    return (
        <div className="card">
            <div className="flex items-center gap-2 mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <SettingsIcon size={20} className="text-accent" style={{ color: 'var(--accent-primary)' }} />
                <h2>Settings</h2>
            </div>

            <div className="grid grid-cols-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div>
                    <label className="block mb-2 font-medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                        Quality (CRF)
                        <div className="tooltip-container ml-1" style={{ display: 'inline-block', marginLeft: '0.25rem' }}>
                            <Info size={14} style={{ color: 'var(--text-secondary)', cursor: 'help' }} />
                            <span className="tooltip-text">
                                Lower CRF means higher quality but larger file size. Recommended: 23.
                            </span>
                        </div>
                    </label>
                    <div className="flex items-center gap-3" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <input
                            type="range"
                            min="18"
                            max="30"
                            step="1"
                            value={options.quality}
                            onChange={(e) => handleChange('quality', parseInt(e.target.value))}
                            className="flex-1"
                            style={{ flex: 1 }}
                        />
                        <span className="font-mono bg-tertiary px-2 py-1 rounded" style={{ fontFamily: 'monospace', backgroundColor: 'var(--bg-tertiary)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                            {options.quality}
                        </span>
                    </div>
                    <div className="text-xs text-secondary mt-1" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Lower is better quality, larger file size.
                    </div>
                </div>

                <div>
                    <label className="block mb-2 font-medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                        Preset
                        <div className="tooltip-container ml-1" style={{ display: 'inline-block', marginLeft: '0.25rem' }}>
                            <Info size={14} style={{ color: 'var(--text-secondary)', cursor: 'help' }} />
                            <span className="tooltip-text">
                                Slower presets provide better compression (smaller size) for the same quality. Recommended: Medium or Slow.
                            </span>
                        </div>
                    </label>
                    <select
                        className="input"
                        value={options.preset}
                        onChange={(e) => handleChange('preset', e.target.value)}
                    >
                        <option value="ultrafast">Ultrafast</option>
                        <option value="superfast">Superfast</option>
                        <option value="veryfast">Veryfast</option>
                        <option value="faster">Faster</option>
                        <option value="fast">Fast</option>
                        <option value="medium">Medium</option>
                        <option value="slow">Slow</option>
                        <option value="slower">Slower</option>
                        <option value="veryslow">Veryslow</option>
                    </select>
                </div>

                <div>
                    <label className="block mb-2 font-medium" style={{ display: 'block', marginBottom: '0.5rem' }}>
                        Codec
                        <div className="tooltip-container ml-1" style={{ display: 'inline-block', marginLeft: '0.25rem' }}>
                            <Info size={14} style={{ color: 'var(--text-secondary)', cursor: 'help' }} />
                            <span className="tooltip-text">
                                HEVC (H.265) offers better compression than H.264 but requires modern hardware. AV1 is best but slow.
                            </span>
                        </div>
                    </label>
                    <select
                        className="input"
                        value={options.codec}
                        onChange={(e) => handleChange('codec', e.target.value)}
                    >
                        <option value="hevc">HEVC (H.265)</option>
                        <option value="h264">H.264</option>
                        <option value="av1">AV1</option>
                        <option value="vp9">VP9</option>
                        <option value="mpeg4">MPEG-4</option>
                    </select>
                </div>

                <div>
                    <label className="block mb-2 font-medium" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        Hardware Acceleration
                        <div className="tooltip-container ml-1" style={{ display: 'inline-block', marginLeft: '0.25rem' }}>
                            <Info size={14} style={{ color: 'var(--text-secondary)', cursor: 'help' }} />
                            <span className="tooltip-text">
                                Not all accelerations are available in all systems. Experiment to see what works best.
                            </span>
                        </div>
                    </label>
                    <select
                        className="input"
                        value={options.hwaccel}
                        onChange={(e) => handleChange('hwaccel', e.target.value)}
                        disabled={processing}
                    >
                        <option value="none">None (CPU)</option>
                        <option value="auto">Auto</option>
                        <option value="cuda">NVIDIA (CUDA)</option>
                        <option value="vaapi">VAAPI (Intel/AMD)</option>
                        <option value="qsv">Intel QSV</option>
                        <option value="videotoolbox">Apple VideoToolbox</option>
                    </select>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                    <label className="flex items-center gap-2 cursor-pointer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={options.tag_original}
                            onChange={(e) => handleChange('tag_original', e.target.checked)}
                            disabled={processing}
                        />
                        <span className="font-medium">Tag Original File as Processed</span>
                        <div className="tooltip-container">
                            <Info size={14} style={{ color: 'var(--text-secondary)', cursor: 'help' }} />
                            <span className="tooltip-text">
                                Adds a metadata flag to the ORIGINAL file to mark it as processed. Useful to avoid reprocessing by mistake.
                            </span>
                        </div>
                    </label>
                </div>

                <div className="checkbox-item">
                    <input
                        type="checkbox"
                        id="stabilize"
                        checked={options.stabilize}
                        onChange={(e) => handleChange('stabilize', e.target.checked)}
                        disabled={processing}
                    />
                    <label htmlFor="stabilize">Stabilize Video</label>
                    <div className="tooltip-container">
                        <Info size={14} className="text-secondary" />
                        <span className="tooltip-text">
                            Applies 2-pass video stabilization using vid.stab.
                            Pass 1 analyzes the video for shakiness.
                            Pass 2 applies the stabilization transform.
                            This process is slower but produces smoother video.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
