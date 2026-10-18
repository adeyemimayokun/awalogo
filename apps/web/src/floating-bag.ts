export type BagPosition = { x: number; y: number };
export const BAG_SIZE = 72;
export const BAG_MARGIN = 16;
export const BAG_POSITION_KEY = "awalogo-v2-bag-position";

export function bagPopoverLayout(position: BagPosition, width: number, height: number) {
  const popupWidth = Math.min(360, width - BAG_MARGIN * 2);
  const above = position.y - BAG_MARGIN - 12;
  const below = height - position.y - BAG_SIZE - BAG_MARGIN - 12;
  const opensAbove = above >= Math.min(420, below);
  const left = Math.max(BAG_MARGIN, Math.min(position.x + BAG_SIZE - popupWidth, width - popupWidth - BAG_MARGIN));
  return {
    width: popupWidth,
    left,
    maxHeight: Math.max(80, Math.min(420, opensAbove ? above : below)),
    ...(opensAbove ? { bottom: height - position.y + 12 } : { top: position.y + BAG_SIZE + 12 }),
    transformOrigin: `${Math.max(0, Math.min(100, (position.x + BAG_SIZE / 2 - left) / popupWidth * 100))}% ${opensAbove ? "bottom" : "top"}`
  };
}

export function constrainBag(position: BagPosition, width: number, height: number): BagPosition {
  return {
    x: Math.max(BAG_MARGIN, Math.min(position.x, Math.max(BAG_MARGIN, width - BAG_SIZE - BAG_MARGIN))),
    y: Math.max(BAG_MARGIN, Math.min(position.y, Math.max(BAG_MARGIN, height - BAG_SIZE - BAG_MARGIN)))
  };
}

export function restoreBag(value: unknown, width: number, height: number): BagPosition {
  const saved = value as Partial<BagPosition> | null;
  if (saved && typeof saved.x === "number" && Number.isFinite(saved.x) && typeof saved.y === "number" && Number.isFinite(saved.y)) {
    return constrainBag({ x: saved.x * width, y: saved.y * height }, width, height);
  }
  return constrainBag({ x: width - BAG_SIZE - 24, y: height - BAG_SIZE - 32 }, width, height);
}

export function assetFlight(start: BagPosition, end: BagPosition) {
  const peak = Math.min(start.y, end.y) - Math.min(160, Math.hypot(end.x - start.x, end.y - start.y) * .25);
  return Array.from({ length: 25 }, (_, index) => {
    const t = index / 24;
    const x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * (start.x + end.x) / 2 + t * t * end.x;
    const y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * peak + t * t * end.y;
    return { offset: t, transform: `translate3d(${x - 28}px,${y - 28}px,0) rotate(${t * 12}deg) scale(${1 - t * .84})`, opacity: t > .9 ? (1 - t) * 10 : 1 };
  });
}
