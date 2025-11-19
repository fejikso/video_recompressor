# Video Reprocessor - Developer Guide

## Project Structure

-   **`src-tauri/`**: Rust backend.
    -   `src/lib.rs`: Core logic (FFmpeg execution, metadata checks, file handling).
    -   `src/models.rs`: Data structures for filters, modifiers, and options.
-   **`src/`**: React frontend.
    -   `App.tsx`: Main application state and logic.
    -   `components/`: UI components (`FileSelector`, `Settings`, etc.).
    -   `types.ts`: TypeScript interfaces shared with backend.

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

## Building

To build the application for production:
```bash
npm run tauri build
```
