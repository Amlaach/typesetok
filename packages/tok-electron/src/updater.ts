import { app, shell } from 'electron';
import * as https from 'https';
import { logger } from './logger';

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  releaseUrl: string;
  downloadUrl?: string;
  publishedAt?: string;
  error?: string;
}

export class TokUpdater {
  private repoOwner = 'TypesetOK';
  private repoName = 'typesetok';
  private currentVersion: string;

  constructor(currentVersion?: string) {
    this.currentVersion = currentVersion || app.getVersion() || '0.7.3';
  }

  public getCurrentVersion(): string {
    return this.currentVersion;
  }

  /**
   * Compares two semantic version strings (e.g. "0.7.0" vs "0.8.0" or "v0.8.0").
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
   */
  public compareVersions(v1: string, v2: string): number {
    const clean1 = v1.replace(/^v/i, '').trim();
    const clean2 = v2.replace(/^v/i, '').trim();
    const parts1 = clean1.split('.').map(n => parseInt(n, 10) || 0);
    const parts2 = clean2.split('.').map(n => parseInt(n, 10) || 0);

    const len = Math.max(parts1.length, parts2.length);
    for (let i = 0; i < len; i++) {
      const p1 = parts1[i] ?? 0;
      const p2 = parts2[i] ?? 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  /**
   * Checks GitHub Releases API for the latest published release.
   */
  public async checkForUpdates(): Promise<UpdateCheckResult> {
    logger.info('[UPDATER] Checking for updates against GitHub Releases...');
    const url = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/releases/latest`;

    return new Promise((resolve) => {
      const options = {
        headers: {
          'User-Agent': `TypesetOK-Desktop/${this.currentVersion}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 8000
      };

      const req = https.get(url, options, (res) => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const release = JSON.parse(data);
              const tagName: string = release.tag_name || release.name || '';
              const latestVersion = tagName.replace(/^v/i, '');
              const hasUpdate = this.compareVersions(latestVersion, this.currentVersion) > 0;

              // Find Windows installer or zip asset if available
              let downloadUrl = release.html_url;
              if (Array.isArray(release.assets)) {
                const exeAsset = release.assets.find((a: any) =>
                  a.name && (a.name.endsWith('.exe') || a.name.endsWith('.zip'))
                );
                if (exeAsset && exeAsset.browser_download_url) {
                  downloadUrl = exeAsset.browser_download_url;
                }
              }

              const result: UpdateCheckResult = {
                hasUpdate,
                currentVersion: this.currentVersion,
                latestVersion,
                releaseName: release.name || tagName,
                releaseNotes: release.body || 'אין הערות שחרור זמינות',
                releaseUrl: release.html_url,
                downloadUrl,
                publishedAt: release.published_at
              };

              logger.info('[UPDATER] Update check completed', { hasUpdate, latestVersion, current: this.currentVersion });
              resolve(result);
            } catch (parseErr: any) {
              logger.warn('[UPDATER] Failed to parse release JSON', { error: parseErr.message });
              resolve({
                hasUpdate: false,
                currentVersion: this.currentVersion,
                latestVersion: this.currentVersion,
                releaseName: '',
                releaseNotes: '',
                releaseUrl: '',
                error: `שגיאה בפענוח נתוני שחרור: ${parseErr.message}`
              });
            }
          } else {
            logger.warn(`[UPDATER] Release API responded with status ${res.statusCode}`);
            resolve({
              hasUpdate: false,
              currentVersion: this.currentVersion,
              latestVersion: this.currentVersion,
              releaseName: '',
              releaseNotes: '',
              releaseUrl: `https://github.com/${this.repoOwner}/${this.repoName}/releases`,
              error: `תגובת שרת GitHub: ${res.statusCode}`
            });
          }
        });
      });

      req.on('error', (err) => {
        logger.warn('[UPDATER] Network error checking for updates', { error: err.message });
        resolve({
          hasUpdate: false,
          currentVersion: this.currentVersion,
          latestVersion: this.currentVersion,
          releaseName: '',
          releaseNotes: '',
          releaseUrl: `https://github.com/${this.repoOwner}/${this.repoName}/releases`,
          error: `שגיאת רשת בבדיקת עדכון: ${err.message}`
        });
      });

      req.on('timeout', () => {
        req.destroy();
        logger.warn('[UPDATER] Timeout checking for updates');
        resolve({
          hasUpdate: false,
          currentVersion: this.currentVersion,
          latestVersion: this.currentVersion,
          releaseName: '',
          releaseNotes: '',
          releaseUrl: `https://github.com/${this.repoOwner}/${this.repoName}/releases`,
          error: 'פסק זמן בבדיקת עדכונים מול השרת'
        });
      });
    });
  }

  public openReleaseUrl(url?: string): void {
    const target = url || `https://github.com/${this.repoOwner}/${this.repoName}/releases`;
    shell.openExternal(target);
  }
}

export const updater = new TokUpdater();
