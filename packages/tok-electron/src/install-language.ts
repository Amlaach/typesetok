/**
 * Language the user picked in the Windows installer, read back from the registry output of
 * `reg query <key>`. Inno Setup writes `Language    REG_SZ    he|en`; the NSIS fallback writes
 * `Installer Language    REG_SZ    1037|1033` (Windows LCIDs). Returns null when neither is present.
 */
export type InstallLanguage = 'he' | 'en';

export function parseInstallLanguage(regQueryOutput: string): InstallLanguage | null {
  if (typeof regQueryOutput !== 'string') return null;
  const inno = /^\s*Language\s+REG_SZ\s+(\S+)\s*$/im.exec(regQueryOutput);
  if (inno) {
    const v = inno[1].toLowerCase();
    if (v === 'he' || v === 'en') return v;
  }
  const nsis = /^\s*Installer Language\s+REG_SZ\s+(\d+)\s*$/im.exec(regQueryOutput);
  if (nsis) {
    if (nsis[1] === '1037') return 'he';
    if (nsis[1] === '1033') return 'en';
  }
  return null;
}

/** Projects folder picked in the installer (`ProjectsDir    REG_SZ    <path>`), or null when absent. */
export function parseInstallProjectsDir(regQueryOutput: string): string | null {
  if (typeof regQueryOutput !== 'string') return null;
  const m = /^\s*ProjectsDir\s+REG_SZ\s+(.+?)\s*$/im.exec(regQueryOutput);
  return m && m[1] ? m[1] : null;
}
