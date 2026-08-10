type HeaderResponse = {
  headers?: {
    get?: (name: string) => string | null;
  };
};

export function readResponseHeader(response: HeaderResponse, name: string) {
  const getHeader = response.headers?.get;
  if (typeof getHeader !== "function") return undefined;

  try {
    return getHeader.call(response.headers, name) ?? undefined;
  } catch {
    return undefined;
  }
}
