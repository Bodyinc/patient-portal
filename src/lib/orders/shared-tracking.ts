/** One checkout ships together. One tracking id covers every medicine in that order. */
export function sharedCheckoutTracking(numbers: Array<string | null | undefined>): string | null {
  const unique = new Set<string>();
  for (const value of numbers) {
    const trimmed = value?.trim();
    if (trimmed) unique.add(trimmed);
  }
  if (unique.size !== 1) return null;
  return [...unique][0];
}
