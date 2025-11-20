# Video Reprocessor

A powerful, cross-platform desktop application for reprocessing video files using FFmpeg. Designed for ease of use without sacrificing control.

## Key Features

*   **Batch Processing**: Queue up multiple files and let it run.
*   **Smart Workflow**: Automatically skips files that have already been processed.
*   **Quality Preservation**: Copies audio streams unmodified to maintain original sound quality.
*   **Stabilization**: Integrated 2-pass video stabilization using `vid.stab`.
*   **Customizable**: Apply various filters and modifiers to suit your needs.
*   **Safe**: Preserves original file metadata and timestamps.

## Installation

### Prerequisites
You need **FFmpeg** installed on your system.

-   **Windows**: Download from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/), extract, and add `bin` to your PATH.
-   **macOS**: `brew install ffmpeg`
-   **Linux**: `sudo apt install ffmpeg`

### Running the App
Download the latest release for your platform and run the installer or executable.

## Usage

1.  **Add Videos**: Drag and drop or select files.
2.  **Configure**: Choose your desired quality (CRF), preset, and any filters (like Stabilization or Crop).
3.  **Process**: Hit start. The app handles the rest, providing real-time logs for each file.

## Advanced Configuration
The application looks for `video_filters.tab` and `video_commands.tab` in the same directory for custom filter definitions. See the [Developer Guide](README_dev.md) for more details.

## Support the Author

If you find this tool useful, consider supporting its development!

[<img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="180" />](https://www.buymeacoffee.com/fejikso)

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.
