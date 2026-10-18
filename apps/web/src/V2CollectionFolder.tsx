export type CollectionPreview = { src: string; dark?: boolean };

export default function V2CollectionFolder({ previews = [] }: { previews?: CollectionPreview[] }) {
  return <span className="v2-collection-folder" aria-hidden="true">
    <span className="v2-folder-back" />
    <span className="v2-folder-papers">{(previews.length ? previews.slice(-3) : [null, null, null]).map((item, index) => <span className={`v2-folder-paper${item?.dark ? " is-dark" : ""}`} key={`${item?.src ?? "empty"}-${index}`}>{item ? <img src={item.src} alt="" draggable={false} /> : <span className="v2-folder-paper-line" />}</span>)}</span>
    <span className="v2-folder-front" />
  </span>;
}
