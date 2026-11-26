/**
 * The chat's attachment rules, in one place for the page and the server: the size limits, the file types each kind of message accepts, and the code languages. Change a number here and
 * both the screen (which refuses early, with a message) and the server (which refuses for real) follow.
 */
const MB = 1024 * 1024;

export const CHAT_LIMITS = {
  /** The largest file of each kind, in bytes. */
  imageBytes: 10 * MB,
  videoBytes: 50 * MB,
  audioBytes: 10 * MB,
  fileBytes: 25 * MB,
  /** Most files in one message. */
  filesPerMessage: 10,
  /** Longest code snippet, in characters. */
  codeChars: 20_000,
  /** Longest voice message, in seconds. */
  voiceSeconds: 300,
  /** Longest caption or text message, in characters. */
  textChars: 2000,
} as const;

export type FileKind = "image" | "video" | "audio" | "file";
export type MessageKind = "text" | "image" | "video" | "audio" | "code" | "file";

/** The extensions each kind accepts (no SVG or HTML: they can carry script). */
export const EXTENSIONS: Record<FileKind, readonly string[]> = {
  image: ["jpg", "jpeg", "png", "webp", "gif"],
  video: ["mp4", "webm", "mov"],
  audio: ["webm", "ogg", "oga", "mp3", "wav", "m4a", "mp4"],
  file: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip", "rar", "json", "xml", "sql", "log"],
};

export const LIMIT_OF: Record<FileKind, number> = { image: CHAT_LIMITS.imageBytes, video: CHAT_LIMITS.videoBytes, audio: CHAT_LIMITS.audioBytes, file: CHAT_LIMITS.fileBytes };

export const CODE_LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "scss", label: "SCSS" },
  { value: "json", label: "JSON" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "php", label: "PHP" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
] as const;
export const CODE_LANGUAGE_VALUES: readonly string[] = CODE_LANGUAGES.map((l) => l.value);

/** The quick reactions offered on a message. */
export const REACTIONS = ["👍", "❤️", "😂", "🎉", "🙏", "👀"] as const;

export const extOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

/** Whether a file of the kind the person chose (photos, videos, voice, documents) is acceptable by its name and type, and why not when it is not. */
export function checkFile(file: { name: string; type: string; size: number }, kind: FileKind): string | null {
  const ext = extOf(file.name);
  if (!EXTENSIONS[kind].includes(ext)) return `${file.name}: .${ext || "?"} files aren't accepted here (${EXTENSIONS[kind].join(", ")}).`;
  // The browser names the type; a photo must say image/*, a video video/*, a voice message audio/*. (A .webm recording may be video/webm: voice accepts either.)
  if (kind === "image" && !file.type.startsWith("image/")) return `${file.name} isn't an image.`;
  if (kind === "video" && !file.type.startsWith("video/")) return `${file.name} isn't a video.`;
  if (kind === "audio" && !(file.type.startsWith("audio/") || file.type.startsWith("video/"))) return `${file.name} isn't audio.`;
  if (file.size <= 0) return `${file.name} is empty.`;
  if (file.size > LIMIT_OF[kind]) return `${file.name} is larger than ${Math.round(LIMIT_OF[kind] / MB)} MB.`;
  return null;
}

export const sizeText = (bytes: number) => (bytes < 1024 ? `${bytes} B` : bytes < MB ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / MB).toFixed(1)} MB`);
