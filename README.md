# Video Reprocessor

A cross-platform desktop application for reprocessing video files using FFmpeg with a user-friendly interface.

## Features

-   **Batch Processing**: Select multiple video files for processing.
-   **Filters & Modifiers**: Apply various video filters and modifiers loaded from configuration files.
-   **Smart Skipping**: Automatically skips files that have already been reprocessed (detected via metadata).
-   **Metadata Preservation**: Preserves original file timestamps and metadata.
-   **Real-time Logging**: View detailed FFmpeg logs for each file during processing.
-   **Abort Capability**: Cancel processing at any time.

## Usage

1.  **Select Files**: Click "Add Videos" to choose the files you want to process.
2.  **Configure Settings**:
    -   Adjust **Quality** (CRF), **Preset**, **Codec**, and **Hardware Acceleration** in the left panel.
    -   Select **Filters** and **Modifiers** from the right panel.
3.  **Start Processing**: Click "Start Processing".
    -   The app will process files sequentially.
    -   Files that have already been processed (tagged with `reprocessed` metadata) will be skipped.
4.  **View Logs**: Click the status icon next to any file to view its specific processing log.

## Configuration

The application loads filters and modifiers from the following files in `/mnt/projects/common/`:
-   `video_filters.tab`: Definitions for video filters.
-   `video_commands.tab`: Definitions for modifiers.

You can edit these files to add or modify the available options.

## Links

-   [GitHub Repository](https://github.com/fejikso/video_recompressor)
-   [Support the Author](https://www.buymeacoffee.com/fejikso)
