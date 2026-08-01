interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

interface RateLimiterOptions {
  maxTokens: number;
  refillRate: number; // tokens per second
  windowMs: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(name: string): Map<string, RateLimitEntry> {
  let store = stores.get(name);
  if (!store) {
    store = new Map();
    stores.set(name, store);
  }
  return store;
}

export function createRateLimiter(name: string, options: RateLimiterOptions) {
  const store = getStore(name);
  const { maxTokens, refillRate, windowMs } = options;

  setInterval(() => {
    const cutoff = Date.now() - windowMs * 2;
    for (const [key, entry] of store) {
      if (entry.lastRefill < cutoff) {
        store.delete(key);
      }
    }
  }, windowMs);

  return {
    check(key: string): { allowed: boolean; retryAfterMs: number } {
      const now = Date.now();
      let entry = store.get(key);

      if (!entry) {
        entry = { tokens: maxTokens, lastRefill: now };
        store.set(key, entry);
      }

      const elapsed = (now - entry.lastRefill) / 1000;
      entry.tokens = Math.min(maxTokens, entry.tokens + elapsed * refillRate);
      entry.lastRefill = now;

      if (entry.tokens >= 1) {
        entry.tokens -= 1;
        return { allowed: true, retryAfterMs: 0 };
      }

      const waitSeconds = (1 - entry.tokens) / refillRate;
      return {
        allowed: false,
        retryAfterMs: Math.ceil(waitSeconds * 1000),
      };
    },
  };
}

export const chatLimiter = createRateLimiter("chat", {
  maxTokens: 60,
  refillRate: 1, // 1 per second = 60/min
  windowMs: 60_000,
});

export const uploadLimiter = createRateLimiter("upload", {
  maxTokens: 20,
  refillRate: 20 / 60, // ~0.33/s = 20/min
  windowMs: 60_000,
});
