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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoOptions {
    pub filters: Vec<String>, // List of short_names
    pub modifiers: Vec<(String, String)>, // List of (short_name, value)
    pub quality: u8,
    pub codec: String,
    pub preset: String,
    pub hwaccel: String,
}
