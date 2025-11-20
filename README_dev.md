# Video Reprocessor - Developer Guide

## Project Structure

-   **`src-tauri/`**: Rust backend.
    -   `src/lib.rs`: Core logic (FFmpeg execution, metadata checks, file handling).
    -   `src/models.rs`: Data structures for filters, modifiers, and options.
-   **`src/`**: React frontend.
    -   `App.tsx`: Main application state and logic.
    -   `components/`: UI components (`FileSelector`, `Settings`, etc.).
    -   `types.ts`: TypeScript interfaces shared with backend.
-   **`.github/workflows/`**: CI/CD pipelines.

## Development Setup

### Prerequisites
-   Node.js & npm
-   Rust & Cargo
-   FFmpeg & FFprobe (in system PATH)

### Running Locally

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Run in development mode:
    ```bash
    npm run tauri dev
    ```

## Backend Logic

### FFmpeg Command Construction
The `process_video` function in `lib.rs` constructs the FFmpeg command dynamically based on user selection:
-   **Global Options**: `-y`, `-hwaccel`
-   **Input**: `-i <file>`
-   **Encoding**: `-c:v <codec>`, `-crf <quality>`, `-preset <preset>`
-   **Filters**: `-vf <filter_chain>` (sorted by priority)
-   **Metadata**: Adds `reprocessed="flags..."` and `comment=PROCESSED_BY_VIDREPROCESS`.

### Metadata & Skipping
The app checks for the `reprocessed` metadata tag (or legacy `comment` tag) using `ffprobe` before processing. If found, the file is skipped.

## Configuration Files
The app reads external configuration files for extensibility:
-   `video_filters.tab`: Tab-separated values defining available video filters.
-   `video_commands.tab`: Tab-separated values defining command modifiers.

## Building and Release

### Local Build
To build the application for your current OS:
```bash
npm run tauri build
```

### Cross-Platform Release (GitHub Actions)
We use GitHub Actions to build for Linux, Windows, and macOS automatically.

1.  **Trigger**: Push a tag starting with `v` (e.g., `v0.1.0`).
2.  **Workflow**: `.github/workflows/release.yml`
3.  **Output**: The workflow creates a GitHub Release with the compiled binaries/installers attached.

# License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.