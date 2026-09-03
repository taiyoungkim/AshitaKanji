/** Pure version decision kept separate so upgrade hydration can be tested in Node. */
export function requiresWordSeedHydration(
  installedVersion: string | null,
  currentVersion: string,
): boolean {
  return installedVersion !== currentVersion;
}
