import { useEffect, useState } from 'react';

/**
 * A render-stable "now" timestamp that refreshes on an interval. Use this
 * instead of calling Date.now() during render (React Compiler purity rule).
 */
export function useNow(refreshMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), refreshMs);
    return () => clearInterval(h);
  }, [refreshMs]);
  return now;
}
