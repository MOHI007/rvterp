// Simple in-memory rate limiting for Edge Functions.
// Note: Edge Functions can run on multiple instances, so this is per-instance.
// For true global rate limiting, a database or Redis solution would be needed.

interface RateLimitInfo {
  attempts: number;
  lockedUntil: number;
}

const rateLimitBucket = new Map<string, RateLimitInfo>();

export function checkRateLimit(ip: string) {
  const now = Date.now();
  let info = rateLimitBucket.get(ip);

  if (!info) {
    info = { attempts: 0, lockedUntil: 0 };
    rateLimitBucket.set(ip, info);
  }

  // Check if currently locked
  if (info.lockedUntil > now) {
    return {
      allowed: false,
      increment: () => {},
      reset: () => {},
    };
  }

  return {
    allowed: true,
    increment: () => {
      if (info) {
        info.attempts += 1;
        if (info.attempts >= 5) {
          info.lockedUntil = now + 15 * 60 * 1000; // 15 minutes
        }
      }
    },
    reset: () => {
      if (info) {
        info.attempts = 0;
        info.lockedUntil = 0;
      }
    }
  };
}
