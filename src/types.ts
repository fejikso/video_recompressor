export interface VideoFilter {
  short_name: string;
  long_name: string;
  priority: number;
  code: string;
}

export interface VideoModifier {
  short_name: string;
  long_name: string;
  code: string;
}

export interface VideoOptions {
  filters: string[];
  modifiers: [string, string][];
  quality: number;
  codec: string;
  preset: string;
  hwaccel: string;
}

export interface FileStatus {
  path: string;
  name: string;
  status: 'pending' | 'processing' | 'done' | 'error' | 'aborted' | 'skipped';
  processed: boolean;
  error?: string;
}

export interface LogPayload {
  path: string;
  message: string;
}
