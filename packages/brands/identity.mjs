export function normalizeIdentity(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\b(limited|ltd|plc|inc|llc)\b/g, "").replace(/[^a-z0-9]/g, "");
}
export function identityCollision(candidate, existing) {
  const names = [candidate.slug, candidate.name, ...(candidate.aliases || [])].map(normalizeIdentity);
  return existing.find((brand) => [brand.slug, brand.name, ...(brand.aliases || [])].some((name) => names.includes(normalizeIdentity(name))));
}
