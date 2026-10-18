export type BagItem = { slug: string; variation: string; format: string };
export type BagState = { items: BagItem[]; undo: { items: BagItem[]; until: number } | null; locked: boolean };
type Action = { type: "pack"; item: BagItem } | { type:"drop"; index:number } | { type:"drop-all"; now:number } | { type:"undo"; now:number } | { type:"expire" } | { type:"lock"; value:boolean };
export function bagReducer(state: BagState, action: Action): BagState {
  if (action.type === "lock") return { ...state, locked:action.value };
  if (action.type === "expire") return { ...state, undo:null };
  if (state.locked) return state;
  if (action.type === "pack") {
    if (state.items.length >= 50 || state.items.some((item) => item.slug === action.item.slug && item.variation === action.item.variation && item.format === action.item.format)) return state;
    return { ...state, items:[...state.items, action.item], undo:null };
  }
  if (action.type === "drop") return { ...state, items:state.items.filter((_, index) => index !== action.index), undo:null };
  if (action.type === "drop-all") return state.items.length ? { ...state, items:[], undo:{ items:state.items, until:action.now + 8000 } } : state;
  return state.undo && action.now < state.undo.until ? { ...state, items:state.undo.items, undo:null } : { ...state, undo:null };
}
