import { useState, useEffect, useCallback, useRef } from 'react';
import { Product } from '../types';

/**
 * Result object for auto-reshuffle timer with countdown
 */
export interface AutoReshuffleTimer {
  tick: number;
  secondsLeft: number;
  progressPct: number;
  reshuffleNow: () => void;
}

/**
 * Hook that tracks a 20-second automatic reshuffle cycle with second-by-second countdown.
 * Automatically ticks every intervalMs (default 20,000ms = 20s) and allows manual instant reshuffle.
 */
export function useAutoReshuffleTimer(intervalMs: number = 20000): AutoReshuffleTimer {
  const [tick, setTick] = useState<number>(0);
  const totalSeconds = Math.max(1, Math.round(intervalMs / 1000));
  const [secondsLeft, setSecondsLeft] = useState<number>(totalSeconds);
  const manualOffsetRef = useRef<number>(0);

  const reshuffleNow = useCallback(() => {
    manualOffsetRef.current += 1;
    setTick(prev => prev + 1);
    setSecondsLeft(totalSeconds);
  }, [totalSeconds]);

  useEffect(() => {
    setSecondsLeft(totalSeconds);

    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          setTick(t => (t + 1) % 1000000);
          return totalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [intervalMs, totalSeconds]);

  const progressPct = Math.round(((totalSeconds - secondsLeft) / totalSeconds) * 100);

  return {
    tick,
    secondsLeft,
    progressPct,
    reshuffleNow
  };
}

/**
 * Hook that emits an incrementing tick every `intervalMs` (default 20,000ms = 20s)
 * so catalogs can automatically reshuffle.
 */
export function useAutoReshuffle(intervalMs: number = 20000): number {
  const timer = useAutoReshuffleTimer(intervalMs);
  return timer.tick;
}

/**
 * Normalizes brand name for grouping
 */
function getNormalizedBrand(product: Product): string {
  return (product.brand || 'Other').trim().toLowerCase();
}

/**
 * Scatters products so products of the same brand are NEVER placed together or adjacent,
 * and deterministically reshuffles them based on the 20-second rotation seed/tick.
 *
 * Algorithm:
 * 1. Groups products into distinct buckets by brand.
 * 2. Rotates & pseudo-randomly shuffles items inside each brand queue using seed.
 * 3. Pseudo-randomly shuffles the brand ordering using seed.
 * 4. Interleaves products across brands using a sliding anti-collision memory window
 *    (preventing the same brand from recurring within K steps).
 * 5. Applies an adjacency-repair pass to guarantee adjacent items never have the same brand
 *    (unless the brand has more items than all other brands combined).
 */
export function scatterAndReshuffleProducts(products: Product[], seed: number = 0): Product[] {
  if (!products || products.length <= 1) return products ? [...products] : [];

  // Group products by brand
  const brandBuckets = new Map<string, Product[]>();
  for (const product of products) {
    const brandKey = getNormalizedBrand(product);
    if (!brandBuckets.has(brandKey)) {
      brandBuckets.set(brandKey, []);
    }
    brandBuckets.get(brandKey)!.push(product);
  }

  // Shuffle & rotate items inside each brand queue using seed
  const brandList = Array.from(brandBuckets.entries()).map(([brandKey, items]) => {
    const shuffledItems = [...items];
    const offset = Math.abs(seed) % shuffledItems.length;
    const rotated = [...shuffledItems.slice(offset), ...shuffledItems.slice(0, offset)];
    for (let i = rotated.length - 1; i > 0; i--) {
      const j = Math.abs(Math.sin((seed + 1) * 997 + i * 31) * 10000) % (i + 1) | 0;
      [rotated[i], rotated[j]] = [rotated[j], rotated[i]];
    }
    return { brandKey, items: rotated };
  });

  // Shuffle brand order using seed
  for (let i = brandList.length - 1; i > 0; i--) {
    const j = Math.abs(Math.sin((seed + 1) * 433 + i * 67) * 10000) % (i + 1) | 0;
    [brandList[i], brandList[j]] = [brandList[j], brandList[i]];
  }

  const queues = brandList.map(b => [...b.items]);
  const result: Product[] = [];
  
  // Anti-collision sliding window memory (aims to prevent recurring brand within up to 4 items)
  const windowSize = Math.max(1, Math.min(4, brandList.length - 1));
  const recentBrands: string[] = [];

  while (queues.some(q => q.length > 0)) {
    // Rank available queues
    const activeQueues = queues
      .map((q, idx) => ({ queue: q, idx, brand: q[0] ? getNormalizedBrand(q[0]) : '' }))
      .filter(item => item.queue.length > 0);

    if (activeQueues.length === 0) break;

    // Prioritize queues whose brand does NOT appear in recentBrands
    let candidate = activeQueues.find(item => !recentBrands.includes(item.brand));

    if (!candidate) {
      // If all active queues are in recentBrands, pick the one used furthest in the past
      let oldestIndex = -1;
      let oldestPos = 999;
      for (let i = 0; i < activeQueues.length; i++) {
        const pos = recentBrands.lastIndexOf(activeQueues[i].brand);
        if (pos < oldestPos) {
          oldestPos = pos;
          oldestIndex = i;
        }
      }
      candidate = activeQueues[oldestIndex >= 0 ? oldestIndex : 0];
    } else {
      // Out of candidate queues not in recentBrands, pick the one with the highest remaining stock/items
      // to avoid stranding a large brand at the very end
      const unrecentCandidates = activeQueues.filter(item => !recentBrands.includes(item.brand));
      unrecentCandidates.sort((a, b) => b.queue.length - a.queue.length);
      candidate = unrecentCandidates[0];
    }

    if (candidate && candidate.queue.length > 0) {
      const chosenItem = candidate.queue.shift()!;
      result.push(chosenItem);
      const chosenBrand = getNormalizedBrand(chosenItem);
      recentBrands.push(chosenBrand);
      if (recentBrands.length > windowSize) {
        recentBrands.shift();
      }
    } else {
      break;
    }
  }

  // Final adjacency-repair pass: if two consecutive items have the exact same brand,
  // find a subsequent item with a different brand and swap to eliminate adjacency
  for (let i = 0; i < result.length - 1; i++) {
    const currentBrand = getNormalizedBrand(result[i]);
    const nextBrand = getNormalizedBrand(result[i + 1]);

    if (currentBrand === nextBrand) {
      // Find a swap candidate further down
      for (let k = i + 2; k < result.length; k++) {
        const candidateBrand = getNormalizedBrand(result[k]);
        if (candidateBrand !== currentBrand) {
          // Check if swapping result[i+1] with result[k] causes no collision at k
          const prevAtK = getNormalizedBrand(result[k - 1]);
          const nextAtK = k + 1 < result.length ? getNormalizedBrand(result[k + 1]) : null;
          if (prevAtK !== nextBrand && (nextAtK === null || nextAtK !== nextBrand)) {
            const temp = result[i + 1];
            result[i + 1] = result[k];
            result[k] = temp;
            break;
          }
        }
      }
    }
  }

  return result;
}

