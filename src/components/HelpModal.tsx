import { X } from 'lucide-react';

interface HelpModalProps {
    onClose: () => void;
}

export default function HelpModal({ onClose }: HelpModalProps) {
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h3>About Video Reprocessor</h3>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body">
                    <p>
                        <strong>Why was this app developed?</strong><br />
                        To easily reprocess video files to reduce their size or change their format for better compatibility or archiving, using the power of FFmpeg without the command-line complexity.
                    </p>
                    <p>
                        <strong>How is it useful?</strong><br />
                        It allows for batch processing of videos with custom filters and modifiers. It's great for shrinking large video libraries or converting videos to a standard format.
                    </p>
                    <p>
                        <strong>Note:</strong> The audio stream is copied unmodified (<code>-c:a copy</code>) to preserve the original audio quality.
                    </p>
                    <p>
                        <strong>Stabilization:</strong> If enabled, a 2-pass stabilization process is applied. This takes longer but produces smoother video.
                    </p>
                    <p>
                        <strong>Filename Convention</strong><br />
                        The application does not overwrite your original files. Instead, it creates a new file with a suffix describing the settings used.
                        <br />
                        <em>Example:</em> <code>video_q23_hevc.mp4</code> indicates Quality 23 and HEVC codec.
                        <br />
                        This allows you to compare the quality and size before deleting the original.
                    </p>
                </div>
            </div>
        </div>
    );
}
