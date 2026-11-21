/**
 * Injects `<script src=url async>` into <head>. Resolves true on load, false on error, timeout or when there is
 * no DOM. Never rejects. On failure the tag is removed so a later retry starts clean.
 */
export function loadScript(url: string, timeoutMs: number, id?: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    try {
      if (typeof document === 'undefined') {
        resolve(false);
        return;
      }
      const el = document.createElement('script');
      let done = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (ok: boolean): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (!ok) el.remove();
        resolve(ok);
      };
      timer = setTimeout(() => finish(false), timeoutMs);
      el.src = url;
      el.async = true;
      if (id) el.id = id;
      el.onload = () => finish(true);
      el.onerror = () => finish(false);
      document.head.appendChild(el);
    } catch {
      resolve(false);
    }
  });
}
