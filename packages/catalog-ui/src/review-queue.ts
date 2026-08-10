export type ReviewQueueEntry = {
  slug: string;
  status: string;
};

export type ReviewQueuePosition = {
  index: number;
  current: number;
  total: number;
  previousSlug: string | null;
  nextSlug: string | null;
};

export function getReviewQueue<T extends ReviewQueueEntry>(catalog: readonly T[]): T[] {
  return catalog.filter((entry) => entry.status === "needs-review");
}

export function getReviewQueuePosition(
  queue: readonly ReviewQueueEntry[],
  selectedSlug: string
): ReviewQueuePosition {
  const selectedIndex = queue.findIndex((entry) => entry.slug === selectedSlug);
  const index = selectedIndex >= 0 ? selectedIndex : 0;
  const hasEntries = queue.length > 0;

  return {
    index,
    current: hasEntries ? index + 1 : 0,
    total: queue.length,
    previousSlug: index > 0 ? queue[index - 1]?.slug ?? null : null,
    nextSlug: index < queue.length - 1 ? queue[index + 1]?.slug ?? null : null
  };
}

export function sourceClassificationLabel(sourceType: string): string {
  return sourceType.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
