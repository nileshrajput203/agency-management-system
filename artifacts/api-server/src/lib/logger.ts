import pino from "pino";
import fs from "fs";
import path from "path";

const isProduction = process.env.NODE_ENV === "production";

function parseMaxSize(sizeStr?: string): number {
  if (!sizeStr) return 10 * 1024 * 1024; // Default 10MB
  const trimmed = sizeStr.trim().toLowerCase();
  const match = trimmed.match(/^(\d+)\s*(b|k|m|g)?$/);
  if (!match) return 10 * 1024 * 1024;
  const num = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "k": return num * 1024;
    case "m": return num * 1024 * 1024;
    case "g": return num * 1024 * 1024 * 1024;
    default: return num;
  }
}

interface StreamState {
  currentPath: string;
  writeStream: fs.WriteStream;
  currentSize: number;
  currentDate: string;
}

export class RotatingLogManager {
  private logDir: string;
  private maxSizeBytes: number;
  private retentionDays: number;
  private streams: Map<string, StreamState> = new Map();
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    this.logDir = process.env.LOG_DIRECTORY || path.resolve(process.cwd(), "logs");
    this.maxSizeBytes = parseMaxSize(process.env.LOG_MAX_SIZE || "10m");
    this.retentionDays = parseInt(process.env.LOG_RETENTION_DAYS || "14", 10);

    this.ensureDir();
    this.runRetentionCleanup();

    // Periodic retention check every 6 hours
    this.cleanupInterval = setInterval(() => {
      this.runRetentionCleanup();
    }, 6 * 60 * 60 * 1000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  private ensureDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getDateString(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private getStreamState(category: string): StreamState {
    let state = this.streams.get(category);
    const currentDate = this.getDateString();
    const filePath = path.join(this.logDir, `${category}.log`);

    if (!state) {
      let currentSize = 0;
      if (fs.existsSync(filePath)) {
        try {
          currentSize = fs.statSync(filePath).size;
        } catch (_) {}
      }
      const writeStream = fs.createWriteStream(filePath, { flags: "a" });
      writeStream.on("error", (err) => {
        console.error(`[LogManager Error] Failed writing to ${filePath}:`, err.message);
      });

      state = { currentPath: filePath, writeStream, currentSize, currentDate };
      this.streams.set(category, state);
    } else {
      if (state.currentDate !== currentDate || state.currentSize >= this.maxSizeBytes) {
        this.rotateStream(category, state, currentDate);
      }
    }

    return state;
  }

  private rotateStream(category: string, state: StreamState, newDate: string) {
    try {
      state.writeStream.end();
      const timestamp = Date.now();
      const rotatedPath = path.join(
        this.logDir,
        `${category}-${state.currentDate}-${timestamp}.log`
      );

      if (fs.existsSync(state.currentPath)) {
        fs.renameSync(state.currentPath, rotatedPath);
      }

      const newStream = fs.createWriteStream(state.currentPath, { flags: "a" });
      newStream.on("error", (err) => {
        console.error(`[LogManager Error] Failed writing to ${state.currentPath}:`, err.message);
      });

      state.writeStream = newStream;
      state.currentSize = 0;
      state.currentDate = newDate;

      setImmediate(() => this.runRetentionCleanup());
    } catch (err: any) {
      console.error(`[LogManager Error] Failed to rotate log for ${category}:`, err.message);
    }
  }

  public writeLogLine(line: string) {
    const bytes = Buffer.byteLength(line, "utf8");

    // Always write to application.log
    this.writeCategory("application", line, bytes);

    let parsed: any;
    try {
      parsed = JSON.parse(line);
    } catch (_) {
      return;
    }

    // Route to error.log if level >= 50 (ERROR / FATAL)
    if (parsed.level && parsed.level >= 50) {
      this.writeCategory("error", line, bytes);
    }

    // Route to specific category file if set
    const cat = parsed.category;
    if (cat && ["access", "auth", "meeting", "notification"].includes(cat)) {
      this.writeCategory(cat, line, bytes);
    }
  }

  private writeCategory(category: string, line: string, bytes: number) {
    const state = this.getStreamState(category);
    state.writeStream.write(line);
    state.currentSize += bytes;
  }

  public runRetentionCleanup() {
    try {
      if (!fs.existsSync(this.logDir)) return;
      const files = fs.readdirSync(this.logDir);
      const now = Date.now();
      const cutoff = this.retentionDays * 24 * 60 * 60 * 1000;

      for (const file of files) {
        if (!file.includes("-")) continue;
        const fullPath = path.join(this.logDir, file);
        try {
          const stats = fs.statSync(fullPath);
          if (now - stats.mtimeMs > cutoff) {
            fs.unlinkSync(fullPath);
          }
        } catch (_) {}
      }
    } catch (_) {}
  }
}

export const logManager = new RotatingLogManager();

const fileDestination = {
  write(chunk: string) {
    logManager.writeLogLine(chunk);
  },
};

const streams: pino.StreamEntry[] = [
  { stream: fileDestination },
];

if (!isProduction) {
  streams.push({
    stream: pino.transport({
      target: "pino-pretty",
      options: { colorize: true },
    }),
  });
} else {
  streams.push({ stream: process.stdout });
}

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        "password",
        "*.password",
        "user.password",
        "body.password",
        "confirmPassword",
        "*.confirmPassword",
        "token",
        "*.token",
        "body.token",
        "accessToken",
        "*.accessToken",
        "refreshToken",
        "*.refreshToken",
        "secret",
        "*.secret",
        "apiKey",
        "*.apiKey",
        "api_key",
        "*.api_key",
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers['set-cookie']",
        "authorization",
        "headers.authorization",
        "cookie",
        "*.cookie",
      ],
      censor: "[REDACTED]",
    },
    base: {
      env: process.env.NODE_ENV || "development",
    },
  },
  pino.multistream(streams)
);

export const authLogger = logger.child({ category: "auth" });
export const meetingLogger = logger.child({ category: "meeting" });
export const notificationLogger = logger.child({ category: "notification" });
export const accessLogger = logger.child({ category: "access" });
export const dbLogger = logger.child({ category: "db" });

