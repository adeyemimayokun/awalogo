import { describe, expect, it } from "vitest";
import { bagReducer, type BagState } from "./bag-actions";
const logo = { slug:"t2-mobile", variation:"9mobile-previous", format:"svg" };
const flag = { slug:"flag-ng", variation:"4x3", format:"png" };
const initial: BagState = { items:[logo, flag], undo:null, locked:false };
describe("pack and drop collection actions", () => {
  it("drops and restores a mixed logo/flag collection within eight seconds", () => {
    const cleared = bagReducer(initial, { type:"drop-all", now:100 });
    expect(cleared.items).toEqual([]);
    expect(cleared.undo?.until).toBe(8100);
    expect(bagReducer(cleared, { type:"undo", now:8099 }).items).toEqual([logo, flag]);
    expect(bagReducer(cleared, { type:"undo", now:8100 }).items).toEqual([]);
    expect(bagReducer(cleared, { type:"expire" }).undo).toBeNull();
  });
  it("dismisses undo after a later mutation rather than overwriting it", () => {
    const cleared = bagReducer(initial, { type:"drop-all", now:0 });
    const packed = bagReducer(cleared, { type:"pack", item:logo });
    expect(packed.undo).toBeNull();
    expect(bagReducer(packed, { type:"undo", now:10 }).items).toEqual([logo]);
    expect(bagReducer(initial, { type:"drop", index:0 }).items).toEqual([flag]);
  });
  it("blocks mutations during ZIP preparation and prevents duplicates", () => {
    const locked = bagReducer(initial, { type:"lock", value:true });
    expect(bagReducer(locked, { type:"drop-all", now:0 })).toBe(locked);
    expect(bagReducer(locked, { type:"drop", index:0 })).toBe(locked);
    expect(bagReducer(locked, { type:"pack", item:logo })).toBe(locked);
    expect(bagReducer(initial, { type:"pack", item:logo })).toBe(initial);
    expect(bagReducer(locked, { type:"lock", value:false }).locked).toBe(false);
  });
});
