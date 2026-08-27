export type ProbationCacheValue = {
  items: Record<string, unknown>[];
  fetchedAt: string;
  expiresAt: number;
};

let probationCache: ProbationCacheValue | null = null;

export function getProbationCache() {
  return probationCache;
}

export function setProbationCache(value: ProbationCacheValue) {
  probationCache = value;
}

export function invalidateProbationCache() {
  probationCache = null;
}
