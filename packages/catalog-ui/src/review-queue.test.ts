import { describe, expect, it } from "vitest";
import promotedCatalog from "../../logos/src/promoted-catalog.json";
import { getReviewQueue, getReviewQueuePosition, sourceClassificationLabel } from "./review-queue";

describe("admin review queue", () => {
  it("contains all 59 catalog entries awaiting review and nothing else", () => {
    const queue = getReviewQueue(promotedCatalog);

    expect(queue).toHaveLength(59);
    expect(queue.every((entry) => entry.status === "needs-review")).toBe(true);
  });

  it("reports progress and bounded previous/next destinations", () => {
    const queue = [
      { slug: "first", status: "needs-review" },
      { slug: "second", status: "needs-review" },
      { slug: "third", status: "needs-review" }
    ];

    expect(getReviewQueuePosition(queue, "first")).toMatchObject({
      current: 1,
      total: 3,
      previousSlug: null,
      nextSlug: "second"
    });
    expect(getReviewQueuePosition(queue, "second")).toMatchObject({
      current: 2,
      total: 3,
      previousSlug: "first",
      nextSlug: "third"
    });
    expect(getReviewQueuePosition(queue, "third")).toMatchObject({
      current: 3,
      total: 3,
      previousSlug: "second",
      nextSlug: null
    });
  });

  it("falls back to the first item and formats source classifications", () => {
    const queue = [{ slug: "first", status: "needs-review" }];

    expect(getReviewQueuePosition(queue, "missing").current).toBe(1);
    expect(getReviewQueuePosition([], "missing").current).toBe(0);
    expect(sourceClassificationLabel("official-brand-page")).toBe("Official Brand Page");
    expect(sourceClassificationLabel("community-catalog")).toBe("Community Catalog");
  });
});
