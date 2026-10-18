export function assetUrl(path: string, origin = location.origin): string {
  return new URL(path, origin).href;
}
