const DEFAULT_TIERS = [15, 30, 45, 60] as const;

/**
 * Next tier = smallest t in overdueTiers where daysBehind >= t
 * and (lastTierSent is null or t > lastTierSent).
 */
export function getNextTier(
  daysBehind: number,
  lastTierSent: number | null,
  overdueTiers: readonly number[] = DEFAULT_TIERS,
): number | null {
  const sorted = [...overdueTiers].sort((a, b) => a - b);
  const minTier = sorted[0];
  if (minTier === undefined || daysBehind < minTier) {
    return null;
  }

  for (const tier of sorted) {
    if (daysBehind >= tier && (lastTierSent === null || tier > lastTierSent)) {
      return tier;
    }
  }
  return null;
}

export { DEFAULT_TIERS };
