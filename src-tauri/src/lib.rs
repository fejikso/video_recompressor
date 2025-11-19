use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Mutex;
use tauri::{Emitter, State};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

mod models;
use models::{VideoFilter, VideoModifier, VideoOptions};

struct AppState {
    current_pid: Mutex<Option<u32>>,
}

fn get_common_path() -> PathBuf {
    if cfg!(target_os = "linux") {
        PathBuf::from("/mnt/projects/common")
    } else if cfg!(target_os = "macos") {
        PathBuf::from("/Volumes/projects/common")
    } else if cfg!(target_os = "windows") {
        PathBuf::from(r"z:\common")
    } else {
        panic!("Unsupported operating system");
    }
}

#[tauri::command]
fn get_filters() -> Result<Vec<VideoFilter>, String> {
    let path = get_common_path().join("video_filters.tab");
    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(b'\t')
        .from_path(path)
        .map_err(|e| e.to_string())?;

    let mut filters = Vec::new();
    for result in rdr.deserialize() {
        let record: VideoFilter = result.map_err(|e| e.to_string())?;
        filters.push(record);
    }
    Ok(filters)
}

#[tauri::command]
fn get_modifiers() -> Result<Vec<VideoModifier>, String> {
    let path = get_common_path().join("video_commands.tab");
    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(b'\t')
        .from_path(path)
        .map_err(|e| e.to_string())?;

    let mut modifiers = Vec::new();
    for result in rdr.deserialize() {
        let record: VideoModifier = result.map_err(|e| e.to_string())?;
        modifiers.push(record);
    }
    Ok(modifiers)
}

#[tauri::command]
async fn check_file_status(path: String) -> Result<bool, String> {
    let output = Command::new("ffprobe")
        .args(&[
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            &path,
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("Failed to run ffprobe".to_string());
    }

    let json_str = String::from_utf8_lossy(&output.stdout);
    let metadata: serde_json::Value = serde_json::from_str(&json_str).map_err(|e| e.to_string())?;

    if let Some(tags) = metadata.get("format").and_then(|f| f.get("tags")) {
        if let Some(comment) = tags.get("comment").and_then(|c| c.as_str()) {
            if comment.contains("PROCESSED_BY_VIDREPROCESS") {
                return Ok(true);
            }
        }
    }

    Ok(false)
}

#[tauri::command]
fn cancel_processing(state: State<AppState>) -> Result<(), String> {
    let mut pid_guard = state.current_pid.lock().map_err(|_| "Failed to lock mutex")?;
    if let Some(pid) = *pid_guard {
        // Kill the process
        let _ = std::process::Command::new("kill")
            .arg(pid.to_string())
            .output();
        *pid_guard = None;
        Ok(())
    } else {
        Ok(()) // No process running
    }
}

#[tauri::command]
async fn process_video(window: tauri::Window, state: State<'_, AppState>, input_path: String, options: VideoOptions) -> Result<(), String> {
    let input_path_buf = PathBuf::from(&input_path);
    let parent = input_path_buf.parent().ok_or("Invalid input path")?;
    let stem = input_path_buf.file_stem().ok_or("Invalid filename")?.to_string_lossy();
    
    // Generate output filename
    let mut suffix_parts = Vec::new();
    
    if !options.filters.is_empty() {
        suffix_parts.push(format!("_{}", options.filters.join("_")));
    }
    
    if !options.modifiers.is_empty() {
        let mod_names: Vec<String> = options.modifiers.iter().map(|(name, _)| name.clone()).collect();
        suffix_parts.push(format!("_{}", mod_names.join("_")));
    }
    
    suffix_parts.push(format!("_q{}_{}", options.quality, options.codec));
    let suffixes = suffix_parts.join("");
    let output_filename = format!("{}{}.mp4", stem, suffixes);
    let final_output_path = parent.join(&output_filename);
    let temp_output_path = parent.join(format!("{}_workinprogress.mp4", stem));

    // Build ffmpeg command
    let mut args = Vec::new();
    
    // 1. Global options
    args.push("-y".to_string());
    
    if options.hwaccel != "none" {
        args.push("-hwaccel".to_string());
        args.push(options.hwaccel.clone());
    }

    // 2. Input
    args.push("-i".to_string());
    args.push(input_path.clone());

    // 3. Encoding Options
    args.push("-c:a".to_string()); args.push("aac".to_string());
    args.push("-ac".to_string()); args.push("1".to_string());
    args.push("-ar".to_string()); args.push("44100".to_string());
    
    args.push("-codec:v".to_string()); args.push(options.codec.clone());
    args.push("-qmin".to_string()); args.push("20".to_string());

    // Modifiers
    for (_, code) in options.modifiers {
        let parts = shlex::split(&code).ok_or("Failed to parse modifier code")?;
        args.extend(parts);
    }

    // Filters
    if !options.filters.is_empty() {
        let all_filters = get_filters()?;
        let mut filter_codes = Vec::new();
        
        let mut selected_filters: Vec<&VideoFilter> = all_filters.iter()
            .filter(|f| options.filters.contains(&f.short_name))
            .collect();
        selected_filters.sort_by_key(|f| f.priority);

        for filter in selected_filters {
            filter_codes.push(filter.code.clone());
        }
        
        if !filter_codes.is_empty() {
            args.push("-vf".to_string());
            args.push(filter_codes.join(","));
        }
    }

    args.push("-qmax".to_string());
    args.push(options.quality.to_string());
    
    args.push("-preset".to_string());
    args.push(options.preset);
    
    args.push("-movflags".to_string());
    args.push("+faststart".to_string());
    
    args.push("-metadata".to_string());
    args.push("comment=PROCESSED_BY_VIDREPROCESS".to_string());
    
    // 4. Output file
    args.push(temp_output_path.to_string_lossy().to_string());

    // Log the command
    let command_str = format!("Command: ffmpeg {}", args.join(" "));
    window.emit("processing-log", &command_str).map_err(|e| e.to_string())?;

    // Execute
    let mut cmd = Command::new("ffmpeg")
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    // Store PID
    if let Some(pid) = cmd.id() {
        if let Ok(mut guard) = state.current_pid.lock() {
            *guard = Some(pid);
        }
    }

    let stderr = cmd.stderr.take().ok_or("Failed to capture stderr")?;
    let mut reader = BufReader::new(stderr).lines();

    while let Some(line) = reader.next_line().await.map_err(|e| e.to_string())? {
        window.emit("processing-log", &line).map_err(|e| e.to_string())?;
    }

    let status = cmd.wait().await.map_err(|e| e.to_string())?;

    // Clear PID
    if let Ok(mut guard) = state.current_pid.lock() {
        *guard = None;
    }

    if status.success() {
        std::fs::rename(&temp_output_path, &final_output_path).map_err(|e| e.to_string())?;
        
        // Copy timestamps
        if let Ok(metadata) = std::fs::metadata(&input_path) {
            if let (Ok(atime), Ok(mtime)) = (metadata.accessed(), metadata.modified()) {
                let _ = filetime::set_file_times(&final_output_path, filetime::FileTime::from_system_time(atime), filetime::FileTime::from_system_time(mtime));
            }
        }
        
        Ok(())
    } else {
        if temp_output_path.exists() {
            let _ = std::fs::remove_file(temp_output_path);
        }
        Err(format!("FFmpeg failed or was aborted. Status: {}", status))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState { current_pid: Mutex::new(None) })
        .invoke_handler(tauri::generate_handler![
            get_filters, 
            get_modifiers, 
            check_file_status, 
            process_video,
            cancel_processing
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
