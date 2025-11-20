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
We use GitHub Actions to build for Linux, Windows, and macOS automatically. This includes generating `.deb`, `.rpm`, `.appimage` (Linux), `.msi`/`.exe` (Windows), `.dmg` (macOS), and `.snap` (Snap Store) packages.

#### How to Trigger a Release
1.  **Update Version**: Ensure `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `snap/snapcraft.yaml` have the new version number (e.g., `0.5.0`).
2.  **Commit Changes**:
    ```bash
    git add .
    git commit -m "chore: bump version to 0.5.0"
    git push
    ```
3.  **Tag the Release**:
    Create a tag starting with `v`. This is what tells GitHub Actions to start the build.
    ```bash
    git tag v0.5.0
    git push origin v0.5.0
    ```
4.  **Watch the Build**:
    -   Go to your GitHub repository.
    -   Click the **Actions** tab.
    -   You will see a workflow run named "Release". Click it to see progress.
5.  **Download Assets**:
    -   Once finished, go to the **Releases** tab (usually on the right sidebar of the repo main page).
    -   You will see a new "Draft" release (or published release) with all the built files attached.

# License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.