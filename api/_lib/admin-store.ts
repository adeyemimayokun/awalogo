export function adminStoreConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}
export async function adminStore<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const origin = new URL(
    process.env.SUPABASE_URL ?? "https://unconfigured.invalid",
  );
  const key = process.env.SUPABASE_SECRET_KEY;
  if (
    origin.protocol !== "https:" ||
    !origin.hostname.endsWith(".supabase.co") ||
    !key
  )
    throw new Error("Admin database is not configured");
  const response = await fetch(`${origin.origin}/rest/v1/${path}`, {
    ...init,
    signal: AbortSignal.timeout(10000),
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok)
    throw new Error(
      `Admin database unavailable (${response.status}); check migration and credentials`,
    );
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}
