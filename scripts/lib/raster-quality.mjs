export function withoutRasterEnlargement(review, asset, compatibility) {
  if (review.without_enlargement === true) return true;
  return asset.format !== "svg" && compatibility[review.slug] !== asset.checksum;
}
