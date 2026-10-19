export function packLayout(sizes: ReadonlyArray<{ width: number; height: number }>) {
  const columns = Math.ceil(Math.sqrt(sizes.length));
  return sizes.map((size, index) => {
    const scale = Math.min(200 / size.width, 140 / size.height);
    const width = size.width * scale;
    const height = size.height * scale;
    return { width, height, x: (index % columns) * 256 + (200 - width) / 2,
      y: Math.floor(index / columns) * 196 + (140 - height) / 2 };
  });
}
