use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Mutex;
use std::time::Instant;
use tauri::{Emitter, State, AppHandle, Manager};
use tauri::path::BaseDirectory;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

mod models;
use models::{VideoFilter, VideoModifier, VideoOptions, ProcessingStats};

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
crop\tcrop frame (pixels)\tvf:crop=in_w-2*#1:in_h-2*#1:#1:#1
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
fn delete_file(path: String) -> Result<(), String> {
    std::fs::remove_file(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn show_in_folder(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);
    let parent = path_buf.parent().ok_or("Invalid path")?;
    opener::open(parent).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    opener::open(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(path, content).map_err(|e| e.to_string())
}

fn move_file(source: &std::path::Path, destination: &std::path::Path) -> Result<(), String> {
    if std::fs::rename(source, destination).is_ok() {
        return Ok(());
    }
    // Fallback to copy and delete
    std::fs::copy(source, destination).map_err(|e| e.to_string())?;
    std::fs::remove_file(source).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn generate_preview(path: String) -> Result<String, String> {
    let temp_dir = std::env::temp_dir();
    let output_path = temp_dir.join(format!("preview_{}.jpg", uuid::Uuid::new_v4()));

    let output = Command::new("ffmpeg")
        .args(&[
            "-y",
            "-i", &path,
            "-ss", "0",
            "-vframes", "1",
            "-q:v", "2",
            &output_path.to_string_lossy()
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(format!("Failed to generate preview: {}", String::from_utf8_lossy(&output.stderr)));
    }

    let image_data = std::fs::read(&output_path).map_err(|e| e.to_string())?;
    let _ = std::fs::remove_file(output_path); // Cleanup

    use base64::{Engine as _, engine::general_purpose};
    let base64_string = general_purpose::STANDARD.encode(image_data);
    
    Ok(format!("data:image/jpeg;base64,{}", base64_string))
}

#[tauri::command]
async fn process_video(window: tauri::Window, state: State<'_, AppState>, input_path: String, options: VideoOptions) -> Result<ProcessingStats, String> {
    let start_time = Instant::now();
    let input_path_buf = PathBuf::from(&input_path);
    let parent = input_path_buf.parent().ok_or("Invalid input path")?;
    let stem = input_path_buf.file_stem().ok_or("Invalid filename")?.to_string_lossy();
    
    let original_size = std::fs::metadata(&input_path).map_err(|e| e.to_string())?.len();

    // Generate output filename
    let mut suffix_parts = Vec::new();
    
    if options.stabilize {
        suffix_parts.push("_stabilized".to_string());
    }

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
    
    // Use system temp dir for intermediate file
    let temp_dir = std::env::temp_dir();
    let temp_output_path = temp_dir.join(format!("{}_{}_workinprogress.mp4", stem, uuid::Uuid::new_v4()));

    // Stabilization Pass 1
    let trf_path = if options.stabilize {
        let trf_filename = format!("{}_{}.trf", stem, uuid::Uuid::new_v4());
        Some(temp_dir.join(&trf_filename))
    } else {
        None
    };

    if options.stabilize {
        if let Some(path) = &trf_path {
            window.emit("processing-log", LogPayload { path: input_path.clone(), message: "Starting Stabilization Pass 1/2...".to_string() }).map_err(|e| e.to_string())?;
            
            // Escape path for filter string: wrap in single quotes and escape existing single quotes
            let path_str = path.to_string_lossy().replace("'", "'\\''");
            
            let mut args_pass1 = Vec::new();
            args_pass1.push("-y".to_string());
            args_pass1.push("-i".to_string());
            args_pass1.push(input_path.clone());
            args_pass1.push("-vf".to_string());
            args_pass1.push(format!("vidstabdetect=stepsize=32:shakiness=10:accuracy=15:result='{}'", path_str));
            args_pass1.push("-f".to_string());
            args_pass1.push("null".to_string());
            args_pass1.push("-".to_string());

            let command_str = format!("Command Pass 1: ffmpeg {}", args_pass1.join(" "));
            window.emit("processing-log", LogPayload { path: input_path.clone(), message: command_str }).map_err(|e| e.to_string())?;

            let mut cmd_pass1 = Command::new("ffmpeg")
                .args(&args_pass1)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .map_err(|e| e.to_string())?;

            if let Some(pid) = cmd_pass1.id() {
                if let Ok(mut guard) = state.current_pid.lock() {
                    *guard = Some(pid);
                }
            }

            let stderr = cmd_pass1.stderr.take().ok_or("Failed to capture stderr")?;
            let mut reader = BufReader::new(stderr).lines();

            while let Some(line) = reader.next_line().await.map_err(|e| e.to_string())? {
                 window.emit("processing-log", LogPayload { path: input_path.clone(), message: line }).map_err(|e| e.to_string())?;
            }

            let status = cmd_pass1.wait().await.map_err(|e| e.to_string())?;
            
            if !status.success() {
                return Err(format!("Stabilization Pass 1 failed. Status: {}", status));
            }
            
            window.emit("processing-log", LogPayload { path: input_path.clone(), message: "Stabilization Pass 1 Complete. Starting Pass 2...".to_string() }).map_err(|e| e.to_string())?;
        }
    }

    // Build flags string for metadata
    let mut flags_desc = Vec::new();
    flags_desc.push(format!("quality={}", options.quality));
    flags_desc.push(format!("codec={}", options.codec));
    flags_desc.push(format!("preset={}", options.preset));
    if options.stabilize {
        flags_desc.push("stabilize=true".to_string());
    }
    if !options.filters.is_empty() {
        flags_desc.push(format!("filters={}", options.filters.join(",")));
    }
    if !options.modifiers.is_empty() {
        let mods: Vec<String> = options.modifiers.iter().map(|(n, v)| format!("{}:{}", n, v)).collect();
        flags_desc.push(format!("modifiers={}", mods.join(",")));
    }
    let reprocessed_tag = flags_desc.join("; ");

    // Build ffmpeg command (Pass 2 or Single Pass)
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
    
    // Audio Copy
    args.push("-c:a".to_string()); args.push("copy".to_string());
    
    args.push("-codec:v".to_string()); args.push(options.codec.clone());
    args.push("-qmin".to_string()); args.push("20".to_string());

    // Filters & Stabilization
    let mut filter_chain = Vec::new();
    
    if options.stabilize {
        if let Some(path) = &trf_path {
             let path_str = path.to_string_lossy().replace("'", "'\\''");
             filter_chain.push(format!("vidstabtransform=input='{}':zoom=0:smoothing=10", path_str));
        }
    }

    if !options.filters.is_empty() {
        let app_handle = window.app_handle();
        let all_filters = get_filters(app_handle.clone())?;
        
        let mut selected_filters: Vec<&VideoFilter> = all_filters.iter()
            .filter(|f| options.filters.contains(&f.short_name))
            .collect();
        selected_filters.sort_by_key(|f| f.priority);

        for filter in selected_filters {
            filter_chain.push(filter.code.clone());
        }
    }

    // Modifiers Logic (Fixed)
    if !options.modifiers.is_empty() {
        let app_handle = window.app_handle();
        let all_modifiers = get_modifiers(app_handle.clone())?;
        
        for (short_name, value) in options.modifiers {
            if let Some(modifier_def) = all_modifiers.iter().find(|m| m.short_name == short_name) {
                let code = modifier_def.code.replace("#1", &value);
                
                if code.starts_with("vf:") {
                    // It's a filter modifier
                    let filter_code = code.strip_prefix("vf:").unwrap_or(&code);
                    filter_chain.push(filter_code.to_string());
                } else {
                    // It's a standard argument modifier
                    let parts = shlex::split(&code).ok_or("Failed to parse modifier code")?;
                    args.extend(parts);
                }
            }
        }
    }
    
    if !filter_chain.is_empty() {
        args.push("-vf".to_string());
        args.push(filter_chain.join(","));
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

    // Cleanup TRF file
    if let Some(path) = &trf_path {
        if path.exists() {
            let _ = std::fs::remove_file(path);
        }
    }

    if status.success() {
        move_file(&temp_output_path, &final_output_path).map_err(|e| e.to_string())?;
        
        // Copy timestamps
        if let Ok(metadata) = std::fs::metadata(&input_path) {
            if let (Ok(atime), Ok(mtime)) = (metadata.accessed(), metadata.modified()) {
                let _ = filetime::set_file_times(&final_output_path, filetime::FileTime::from_system_time(atime), filetime::FileTime::from_system_time(mtime));
            }
        }
        
        let new_size = std::fs::metadata(&final_output_path).map_err(|e| e.to_string())?.len();
        let duration_secs = start_time.elapsed().as_secs_f64();

        // Tag Original Logic
        if options.tag_original {
            window.emit("processing-log", LogPayload { path: input_path.clone(), message: "Tagging original file...".to_string() }).map_err(|e| e.to_string())?;
            
            let temp_tag_path = parent.join(format!("{}_tagged_temp.mp4", stem));
            
            let tag_args = vec![
                "-y".to_string(),
                "-i".to_string(), input_path.clone(),
                "-c".to_string(), "copy".to_string(),
                "-map_metadata".to_string(), "0".to_string(),
                "-metadata".to_string(), "reprocessed=tagged_as_processed".to_string(),
                temp_tag_path.to_string_lossy().to_string()
            ];

            let tag_output = Command::new("ffmpeg")
                .args(&tag_args)
                .output()
                .await
                .map_err(|e| e.to_string())?;

            if tag_output.status.success() {
                // Replace original with tagged
                if let Err(e) = move_file(&temp_tag_path, &PathBuf::from(&input_path)) {
                    window.emit("processing-log", LogPayload { path: input_path.clone(), message: format!("Failed to replace original file with tagged version: {}", e) }).map_err(|e| e.to_string())?;
                    let _ = std::fs::remove_file(&temp_tag_path); // Cleanup
                } else {
                     window.emit("processing-log", LogPayload { path: input_path.clone(), message: "Original file successfully tagged.".to_string() }).map_err(|e| e.to_string())?;
                }
            } else {
                window.emit("processing-log", LogPayload { path: input_path.clone(), message: format!("Failed to tag original file: {}", String::from_utf8_lossy(&tag_output.stderr)) }).map_err(|e| e.to_string())?;
                let _ = std::fs::remove_file(&temp_tag_path); // Cleanup
            }
        }

        Ok(ProcessingStats {
            duration_secs,
            original_size,
            new_size,
            output_path: final_output_path.to_string_lossy().to_string(),
        })
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
            cancel_processing,
            delete_file,
            show_in_folder,
            open_file,
            save_text_file,
            generate_preview
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
