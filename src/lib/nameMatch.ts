export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function matchNames(
  breezeNames: string[],
  timeeroNames: string[]
): Map<string, string> {
  const result = new Map<string, string>();
  const normalizedTimeero = timeeroNames.map(n => ({ original: n, normalized: normalizeName(n) }));
  const usedTimeero = new Set<string>();

  // Pass 1: exact match (case-insensitive, trimmed)
  for (const bn of breezeNames) {
    const norm = normalizeName(bn);
    const match = normalizedTimeero.find(t => t.normalized === norm && !usedTimeero.has(t.original));
    if (match) {
      result.set(bn, match.original);
      usedTimeero.add(match.original);
    }
  }

  // Pass 2: fuzzy - first/last swap, partial match
  for (const bn of breezeNames) {
    if (result.has(bn)) continue;
    const norm = normalizeName(bn);
    const parts = norm.split(' ');

    for (const t of normalizedTimeero) {
      if (usedTimeero.has(t.original)) continue;
      const tParts = t.normalized.split(' ');

      // First+last match in any order
      if (parts.length >= 2 && tParts.length >= 2) {
        const bFirst = parts[0], bLast = parts[parts.length - 1];
        const tFirst = tParts[0], tLast = tParts[tParts.length - 1];
        if ((bFirst === tFirst && bLast === tLast) || (bFirst === tLast && bLast === tFirst)) {
          result.set(bn, t.original);
          usedTimeero.add(t.original);
          break;
        }
      }

      // Levenshtein distance < 3 for short names
      if (levenshtein(norm, t.normalized) <= 2) {
        result.set(bn, t.original);
        usedTimeero.add(t.original);
        break;
      }
    }
  }

  return result;
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}
