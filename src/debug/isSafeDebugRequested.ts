/*
  Ayrı dosyada: main.tsx bunu statik import ediyor. Kutunun kendisi
  (safeAreaDebug.ts) yalnızca bu true dönünce dinamik olarak yüklenir.
*/

/** Sorgu dizesinde ?debug=safe var mı. */
export function isSafeDebugRequested(search: string): boolean {
  return new URLSearchParams(search).get("debug") === "safe";
}
