use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoFilter {
    pub short_name: String,
    pub long_name: String,
    pub priority: i8,
    pub code: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoModifier {
    pub short_name: String,
    pub long_name: String,
    pub code: String,
}

#[derive(serde::Deserialize, serde::Serialize)]
pub struct VideoOptions {
    pub filters: Vec<String>,
    pub modifiers: Vec<(String, String)>,
    pub quality: u8,
    pub codec: String,
    pub preset: String,
    pub hwaccel: String,
    pub tag_original: bool,
    pub stabilize: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProcessingStats {
    pub duration_secs: f64,
    pub original_size: u64,
    pub new_size: u64,
    pub output_path: String,
}
