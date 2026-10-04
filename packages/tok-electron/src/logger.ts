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

const LOG_FILE_RE = /^tok-(\d{4}-\d{2}-\d{2})\.log$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Daily rotating file logger (logs/tok-YYYY-MM-DD.log under userData).
 *
 * File writes are buffered and flushed asynchronously in order, so logging never
 * blocks the main process (and therefore never delays window painting or IPC).
 * Pending lines are flushed synchronously when the process exits.
 */
export class TokLogger {
  private logDir: string;
  private retentionDays: number;
  private dirReady = false;
  private pending: { file: string; text: string }[] = [];
  private flushing = false;
  private exitHookInstalled = false;

  constructor(retentionDays: number = 14) {
    this.retentionDays = retentionDays;
    this.logDir = TokLogger.resolveLogDir();
  }

  private static resolveLogDir(): string {
    try {
      return path.join(app.getPath('userData'), 'logs');
    } catch {
      return path.join(process.cwd(), 'logs');
    }
  }

  /**
   * Resolves the final log directory (userData is only reliable once the app is
   * ready). Cheap: no directory scan. Old-log cleanup is left to the caller
   * (see cleanOldLogs) so it can run off the startup path.
   */
  public init(retentionDays?: number): void {
    if (retentionDays !== undefined) {
      this.retentionDays = Math.max(1, retentionDays);
    }
    this.logDir = TokLogger.resolveLogDir();
    this.dirReady = false;
    this.installExitHook();
    this.info('TokLogger initialized. Log directory:', { dir: this.logDir, retentionDays: this.retentionDays });
  }

  public setRetentionDays(days: number): void {
    const n = Number(days);
    this.retentionDays = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : this.retentionDays;
    this.cleanOldLogs().catch(() => {});
  }

  public getRetentionDays(): number {
    return this.retentionDays;
  }

  public getLogDir(): string {
    return this.logDir;
  }

  private getTodayFilename(): string {
    const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
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

    if (level === 'ERROR') {
      console.error(`[TOK] ${message}`, meta ?? '');
    } else if (level === 'WARN') {
      console.warn(`[TOK] ${message}`, meta ?? '');
    } else {
      console.log(`[TOK] ${message}`, meta ?? '');
    }

    this.pending.push({ file: this.getTodayFilename(), text: `[${timestamp}] [${level}] ${message}${metaStr}\n` });
    if (!this.flushing) {
      this.flushing = true;
      setImmediate(() => this.flushAsync());
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

  /** Groups consecutive pending lines by target file (date rollover safe). */
  private takeBatches(): { file: string; text: string }[] {
    const batches: { file: string; text: string }[] = [];
    for (const entry of this.pending) {
      const last = batches[batches.length - 1];
      if (last && last.file === entry.file) last.text += entry.text;
      else batches.push({ ...entry });
    }
    this.pending = [];
    return batches;
  }

  private async flushAsync(): Promise<void> {
    try {
      while (this.pending.length) {
        if (!this.dirReady) {
          await fs.promises.mkdir(this.logDir, { recursive: true });
          this.dirReady = true;
        }
        for (const batch of this.takeBatches()) {
          await fs.promises.appendFile(batch.file, batch.text, 'utf-8');
        }
      }
    } catch (err: any) {
      console.error('[TOK-LOGGER] Failed to write log:', err?.message);
      this.pending = [];
    } finally {
      this.flushing = false;
      // A line may have been queued after the loop's last check.
      if (this.pending.length) {
        this.flushing = true;
        setImmediate(() => this.flushAsync());
      }
    }
  }

  /** Writes any queued lines synchronously (used on process exit). */
  public flushSync(): void {
    if (!this.pending.length) return;
    try {
      fs.mkdirSync(this.logDir, { recursive: true });
      for (const batch of this.takeBatches()) {
        fs.appendFileSync(batch.file, batch.text, 'utf-8');
      }
    } catch (err: any) {
      console.error('[TOK-LOGGER] Failed to flush log:', err?.message);
    }
  }

  private installExitHook(): void {
    if (this.exitHookInstalled) return;
    this.exitHookInstalled = true;
    process.once('exit', () => this.flushSync());
  }

  private isExpired(file: string, mtimeMs: number, now: number, maxAgeMs: number): boolean {
    const match = file.match(LOG_FILE_RE);
    if (!match) return false;
    const fileDate = new Date(match[1]).getTime();
    const isOldByDate = !isNaN(fileDate) && now - fileDate > maxAgeMs;
    return isOldByDate || now - mtimeMs > maxAgeMs;
  }

  /** Deletes log files older than retentionDays (by file-name date or mtime). Non-blocking. */
  public async cleanOldLogs(retentionDays: number = this.retentionDays): Promise<number> {
    const now = Date.now();
    const maxAgeMs = Math.max(1, retentionDays) * DAY_MS;
    let files: string[];
    try {
      files = await fs.promises.readdir(this.logDir);
    } catch {
      return 0; // no log dir yet
    }
    let deletedCount = 0;
    for (const file of files) {
      if (!LOG_FILE_RE.test(file)) continue;
      const filePath = path.join(this.logDir, file);
      try {
        const stats = await fs.promises.stat(filePath);
        if (this.isExpired(file, stats.mtimeMs, now, maxAgeMs)) {
          await fs.promises.unlink(filePath);
          deletedCount++;
        }
      } catch (err: any) {
        console.error(`[TOK-LOGGER] Failed to clean ${file}:`, err?.message);
      }
    }
    if (deletedCount) this.info(`[TOK-LOGGER] Cleaned ${deletedCount} old log file(s) (retention: ${retentionDays} days)`);
    return deletedCount;
  }

  public async getRecentLogs(limit: number = 100): Promise<string[]> {
    // Make sure lines logged a moment ago are on disk before reading.
    this.flushSync();
    try {
      const files = (await fs.promises.readdir(this.logDir))
        .filter((f) => LOG_FILE_RE.test(f))
        .sort()
        .reverse();

      const lines: string[] = [];
      for (const file of files) {
        const content = await fs.promises.readFile(path.join(this.logDir, file), 'utf-8');
        lines.push(...content.split('\n').filter(Boolean).reverse());
        if (lines.length >= limit) break;
      }
      return lines.slice(0, limit);
    } catch (err: any) {
      if (err?.code === 'ENOENT') return [];
      return [`[ERROR reading logs: ${err?.message}]`];
    }
  }

  public async openLogsFolder(): Promise<boolean> {
    try {
      await fs.promises.mkdir(this.logDir, { recursive: true });
    } catch {
      return false;
    }
    const err = await shell.openPath(this.logDir);
    return !err;
  }
}

export const logger = new TokLogger();
