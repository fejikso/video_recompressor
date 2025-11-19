use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Mutex;
use tauri::{Emitter, State, AppHandle, Manager};
use tauri::path::BaseDirectory;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

mod models;
use models::{VideoFilter, VideoModifier, VideoOptions};

const DEFAULT_FILTERS: &str = "short_name\tlong_name\tpriority\tcode
quart\tquarter size\t10\tscale=iw/4:-1
half\thalve size\t10\tscale=iw/2:-1
thrqts\t3/4 size\t10\tscale=iw*0.75:-1
eighth\t1/8 size\t10\tscale=iw*0.125:-1
denoise\tdenoise default\t-1\thqdn3d=3:3:2:2
denoise_sft\tdenoise soft\t-1\thqdn3d=3:3:2:2
denoise_vsft\tdenoise very soft\t-1\thqdn3d=2:2:1:1
atadenoise\tadaptive temporal averaging denoiser\t-1\tatadenoise
bm3d\tblock-matching 3d denoiser\t-1\tbm3d
nlm\tnon-local means denoiser\t-1\tnlmeans
deshake\tdeshake\t0\tdeshake,crop=in_w-32:in_h-32:16:16
rot+90\trotate +90 degrees\t1\ttranspose=1
rot-90\trotate -90 degrees\t1\ttranspose=2
rot180\trotate 180 degrees\t1\ttranspose=2,transpose=2
sab\tshape adaptive blur\t-2\tsab
w3fdif\tdeinterlace w3fdif\t-10\tw3fdif
sharp\tsharpen\t5\tsmartblur=lr=2.00:ls=-0.90:lt=-5.0:cr=0.5:cs=1.0:ct=1.5
";

const DEFAULT_MODIFIERS: &str = "short_name\tlong_name\tcode
ss\tstart (secs)\t-ss #1
t\tduration (secs)\t-t #1
";

struct AppState {
    current_pid: Mutex<Option<u32>>,
}

#[derive(Clone, serde::Serialize)]
struct LogPayload {
    path: String,
    message: String,
}

fn get_config_path(app: &AppHandle, filename: &str) -> Result<PathBuf, String> {
    app.path()
        .resolve(filename, BaseDirectory::AppConfig)
        .map_err(|e| e.to_string())
}

fn ensure_config_files(app: &AppHandle) -> Result<(), String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    
    if !config_dir.exists() {
        std::fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }

    let filters_path = config_dir.join("video_filters.tab");
    if !filters_path.exists() {
        std::fs::write(&filters_path, DEFAULT_FILTERS).map_err(|e| e.to_string())?;
    }

    let modifiers_path = config_dir.join("video_commands.tab");
    if !modifiers_path.exists() {
        std::fs::write(&modifiers_path, DEFAULT_MODIFIERS).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn get_filters(app: AppHandle) -> Result<Vec<VideoFilter>, String> {
    let path = get_config_path(&app, "video_filters.tab")?;
    
    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(b'\t')
        .from_path(path)
        .map_err(|e| e.to_string())?;

    let mut filters = Vec::new();
    for result in rdr.deserialize() {
        let filter: VideoFilter = result.map_err(|e| e.to_string())?;
        filters.push(filter);
    }
    Ok(filters)
}

#[tauri::command]
fn get_modifiers(app: AppHandle) -> Result<Vec<VideoModifier>, String> {
    let path = get_config_path(&app, "video_commands.tab")?;

    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(b'\t')
        .from_path(path)
        .map_err(|e| e.to_string())?;

    let mut modifiers = Vec::new();
    for result in rdr.deserialize() {
        let modifier: VideoModifier = result.map_err(|e| e.to_string())?;
        modifiers.push(modifier);
    }
    Ok(modifiers)
}

#[tauri::command]
async fn check_file_status(path: String) -> Result<String, String> {
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
        // Check for our specific tag
        if let Some(_) = tags.get("reprocessed") {
            return Ok("skipped".to_string());
        }
        // Legacy check (optional, but good for backward compatibility if any)
        if let Some(comment) = tags.get("comment").and_then(|c| c.as_str()) {
            if comment.contains("PROCESSED_BY_VIDREPROCESS") {
                return Ok("skipped".to_string());
            }
        }
    }

    Ok("pending".to_string())
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

    // Build flags string for metadata
    let mut flags_desc = Vec::new();
    flags_desc.push(format!("quality={}", options.quality));
    flags_desc.push(format!("codec={}", options.codec));
    flags_desc.push(format!("preset={}", options.preset));
    if !options.filters.is_empty() {
        flags_desc.push(format!("filters={}", options.filters.join(",")));
    }
    if !options.modifiers.is_empty() {
        let mods: Vec<String> = options.modifiers.iter().map(|(n, v)| format!("{}:{}", n, v)).collect();
        flags_desc.push(format!("modifiers={}", mods.join(",")));
    }
    let reprocessed_tag = flags_desc.join("; ");

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
    args.push("-map_metadata".to_string()); args.push("0".to_string()); // Copy global metadata
    
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
        // get_filters now requires AppHandle, but process_video doesn't have it directly.
        // This means get_filters cannot be called here directly without passing AppHandle
        // to process_video, which is not in the user's instruction.
        // For now, I'll assume get_filters is called elsewhere or its logic is duplicated.
        // Given the instruction, I'll keep the original logic for filters here,
        // but it won't use the new `get_filters` that takes `AppHandle`.
        // This is a potential inconsistency based on the provided edit block.
        // However, the instruction only says "Update `get_filters` and `get_modifiers` to use config dir."
        // It doesn't say to update `process_video`'s call to `get_filters`.
        // I will make `process_video` call the *new* `get_filters` by adding `app: AppHandle` to its signature.
        // This is a necessary change for the code to compile and be consistent.
        let app_handle = window.app_handle(); // Get AppHandle from window
        let all_filters = get_filters(app_handle.clone())?;
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
    
    // Metadata tags
    args.push("-metadata".to_string());
    args.push(format!("reprocessed={}", reprocessed_tag));
    
    args.push("-metadata".to_string());
    args.push("comment=PROCESSED_BY_VIDREPROCESS".to_string()); // Keep legacy tag for now
    
    // 4. Output file
    args.push(temp_output_path.to_string_lossy().to_string());

    // Log the command
    let command_str = format!("Command: ffmpeg {}", args.join(" "));
    window.emit("processing-log", LogPayload { path: input_path.clone(), message: command_str }).map_err(|e| e.to_string())?;

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
        window.emit("processing-log", LogPayload { path: input_path.clone(), message: line }).map_err(|e| e.to_string())?;
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
        .setup(|app| {
            ensure_config_files(app.handle())?;
            Ok(())
        })
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
