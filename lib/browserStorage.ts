export function readSessionValue(key: string): string | null {
  try { return window.sessionStorage.getItem(key); } catch { return null; }
}

export function writeSessionValue(key: string, value: string): void {
  try { window.sessionStorage.setItem(key, value); } catch { /* Storage is optional. */ }
}

export function readLocalValue(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
export function writeLocalValue(key: string, value: string): void {
  try { window.localStorage.setItem(key, value); } catch { /* Storage is optional. */ }
}
