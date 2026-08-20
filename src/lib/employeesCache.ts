type EmployeesCacheState = {
  entries: Map<string, { value: unknown; expiresAt: number }>;
};

const EMPLOYEES_CACHE_TTL_MS = 60_000;
const GLOBAL_CACHE_KEY = "__s_recruit_employees_cache__";

const globalWithCache = globalThis as typeof globalThis & {
  [GLOBAL_CACHE_KEY]?: EmployeesCacheState;
};

function getCacheState(): EmployeesCacheState {
  if (!globalWithCache[GLOBAL_CACHE_KEY]) {
    globalWithCache[GLOBAL_CACHE_KEY] = {
      entries: new Map(),
    };
  }

  return globalWithCache[GLOBAL_CACHE_KEY];
}

export function getCachedEmployees(key = "list:full"): unknown[] | null {
  const cachedValue = getCachedEmployeeValue<unknown[]>(key);
  return Array.isArray(cachedValue) ? cachedValue : null;
}

export function setCachedEmployees(items: unknown[], key = "list:full") {
  setCachedEmployeeValue(key, items);
}

export function getCachedEmployeeValue<T = unknown>(key: string): T | null {
  const cache = getCacheState();
  const entry = cache.entries.get(key);
  if (!entry || Date.now() >= entry.expiresAt) {
    if (entry) cache.entries.delete(key);
    return null;
  }

  return entry.value as T;
}

export function setCachedEmployeeValue(key: string, value: unknown) {
  const cache = getCacheState();
  cache.entries.set(key, {
    value,
    expiresAt: Date.now() + EMPLOYEES_CACHE_TTL_MS,
  });
}

export function invalidateEmployeesCache() {
  const cache = getCacheState();
  cache.entries.clear();
}
