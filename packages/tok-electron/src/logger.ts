import { app, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: unknown;
}

export class TokLogger {
  private logDir: string;
  private retentionDays: number;
  private initialized = false;

  constructor(retentionDays: number = 14) {
    this.retentionDays = retentionDays;
    // When app is not yet ready, use fallback until init is called
    try {
      this.logDir = path.join(app.getPath('userData'), 'logs');
    } catch {
      this.logDir = path.join(process.cwd(), 'logs');
    }
  }

  public init(retentionDays?: number): void {
    if (retentionDays !== undefined) {
      this.retentionDays = retentionDays;
    }
    try {
      this.logDir = path.join(app.getPath('userData'), 'logs');
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      this.initialized = true;
      this.cleanOldLogs(this.retentionDays);
      this.info('TokLogger initialized. Log directory:', { dir: this.logDir, retentionDays: this.retentionDays });
    } catch (err: any) {
      console.error('[TOK-LOGGER] Failed to initialize logger:', err.message);
    }
  }

  public setRetentionDays(days: number): void {
    this.retentionDays = Math.max(1, days);
    this.cleanOldLogs(this.retentionDays);
  }

  public getRetentionDays(): number {
    return this.retentionDays;
  }

  public getLogDir(): string {
    return this.logDir;
  }

  private getTodayFilename(): string {
    const d = new Date();
    const dateStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDir, `tok-${dateStr}.log`);
  }

  public log(level: LogLevel, message: string, meta?: unknown): void {
    const timestamp = new Date().toISOString();
    let metaStr = '';
    if (meta !== undefined) {
      try {
        metaStr = ' ' + JSON.stringify(meta);
      } catch {
        metaStr = ' [Circular/Unserializable meta]';
      }
    }
    const logLine = `[${timestamp}] [${level}] ${message}${metaStr}\n`;

    // Console output
    if (level === 'ERROR') {
      console.error(`[TOK] ${message}`, meta || '');
    } else if (level === 'WARN') {
      console.warn(`[TOK] ${message}`, meta || '');
    } else {
      console.log(`[TOK] ${message}`, meta || '');
    }

    // Write to file
    if (!this.initialized) {
      try {
        if (!fs.existsSync(this.logDir)) {
          fs.mkdirSync(this.logDir, { recursive: true });
        }
        this.initialized = true;
      } catch {
        return;
      }
    }

    try {
      const file = this.getTodayFilename();
      fs.appendFileSync(file, logLine, 'utf-8');
    } catch (err: any) {
      console.error('[TOK-LOGGER] Failed to write log:', err.message);
    }
  }

  public info(message: string, meta?: unknown): void {
    this.log('INFO', message, meta);
  }

  public warn(message: string, meta?: unknown): void {
    this.log('WARN', message, meta);
  }

  public error(message: string, meta?: unknown): void {
    this.log('ERROR', message, meta);
  }

  public debug(message: string, meta?: unknown): void {
    this.log('DEBUG', message, meta);
  }

  /**
   * Scans log files and deletes any file whose age exceeds retentionDays.
   */
  public cleanOldLogs(retentionDays: number = this.retentionDays): number {
    if (!fs.existsSync(this.logDir)) return 0;

    let deletedCount = 0;
    const now = Date.now();
    const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;

    try {
      const files = fs.readdirSync(this.logDir);
      for (const file of files) {
        // Pattern: tok-YYYY-MM-DD.log
        const match = file.match(/^tok-(\d{4}-\d{2}-\d{2})\.log$/);
        if (!match) continue;

        const filePath = path.join(this.logDir, file);
        const dateStr = match[1];
        const fileDate = new Date(dateStr).getTime();

        const isOldByDate = !isNaN(fileDate) && (now - fileDate > maxAgeMs);
        const stats = fs.statSync(filePath);
        const isOldByMtime = (now - stats.mtimeMs > maxAgeMs);

        if (isOldByDate || isOldByMtime) {
          try {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log(`[TOK-LOGGER] Cleaned old log file: ${file} (retention: ${retentionDays} days)`);
          } catch (err: any) {
            console.error(`[TOK-LOGGER] Failed to delete ${file}:`, err.message);
          }
        }
      }
    } catch (err: any) {
      console.error('[TOK-LOGGER] Error scanning log directory:', err.message);
    }

    return deletedCount;
  }

  public getRecentLogs(limit: number = 100): string[] {
    if (!fs.existsSync(this.logDir)) return [];
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(f => f.startsWith('tok-') && f.endsWith('.log'))
        .sort()
        .reverse();

      const lines: string[] = [];
      for (const file of files) {
        const content = fs.readFileSync(path.join(this.logDir, file), 'utf-8');
        const fileLines = content.split('\n').filter(Boolean);
        lines.push(...fileLines.reverse());
        if (lines.length >= limit) break;
      }
      return lines.slice(0, limit);
    } catch (err: any) {
      return [`[ERROR reading logs: ${err.message}]`];
    }
  }

  public openLogsFolder(): boolean {
    if (!fs.existsSync(this.logDir)) {
      try {
        fs.mkdirSync(this.logDir, { recursive: true });
      } catch {
        return false;
      }
    }
    shell.openPath(this.logDir);
    return true;
  }
}

export const logger = new TokLogger();
