import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { VideoOptions } from '../types';

interface Props {
    options: VideoOptions;
    onChange: (options: VideoOptions) => void;
}

export const Settings: React.FC<Props> = ({ options, onChange }) => {
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
                    <label className="block mb-2 font-medium" style={{ display: 'block', marginBottom: '0.5rem' }}>Quality (CRF)</label>
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
                    <label className="block mb-2 font-medium" style={{ display: 'block', marginBottom: '0.5rem' }}>Preset</label>
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
                    <label className="block mb-2 font-medium" style={{ display: 'block', marginBottom: '0.5rem' }}>Codec</label>
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
                    <label className="block mb-2 font-medium" style={{ display: 'block', marginBottom: '0.5rem' }}>Hardware Acceleration</label>
                    <select
                        className="input"
                        value={options.hwaccel}
                        onChange={(e) => handleChange('hwaccel', e.target.value)}
                    >
                        <option value="none">None (CPU)</option>
                        <option value="auto">Auto</option>
                        <option value="cuda">NVIDIA (CUDA)</option>
                        <option value="vaapi">VAAPI (Intel/AMD)</option>
                        <option value="qsv">Intel QSV</option>
                        <option value="videotoolbox">Apple VideoToolbox</option>
                    </select>
                </div>
            </div>
        </div>
    );
};
