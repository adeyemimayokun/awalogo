type Format = { type: string; url: string; checksum: string; [key: string]: unknown };
export function renderFingerprint(kind: string, checksum: string, format: string, options: unknown): string;
export function primaryRenderOptions(review: any, asset: any, compatibility: any): { trimPadding: boolean; withoutEnlargement: boolean; normalization: string | null };
export function formatsFingerprint(formats: unknown): string;
export function cachedPublishedFormats<T extends Format>(key: string, fingerprint: string, formats: T[] | undefined, read: (path: string) => Promise<Buffer | null>, normalization?: string | null): Promise<{ formats: T[]; outputs: { path: string; bytes: Buffer }[] } | null>;
