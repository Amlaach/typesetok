let versionPromise: Promise<string> | null = null;

/** The running app's version from the main process (package.json), or '' when unavailable. */
export function getAppVersion(): Promise<string> {
  if (!versionPromise) {
    versionPromise = (async () => {
      try {
        const info = await (window as any).tokIpc?.getAppInfo?.();
        return typeof info?.version === 'string' ? info.version : '';
      } catch {
        return '';
      }
    })();
  }
  return versionPromise;
}

/** Fills `el` with the version once it is known, formatted by `format`. */
export function fillAppVersion(el: HTMLElement, format: (v: string) => string = (v) => `v${v}`): void {
  getAppVersion().then((v) => {
    if (v) el.textContent = format(v);
  });
}
