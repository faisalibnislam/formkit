/**
 * Matrix and ranking answers. A matrix answer is one value per ticked cell,
 * "Row: Column", so it reads plainly in exports and webhooks; a ranking is
 * the options in the order the person put them.
 */

export const cell = (row: string, column: string) => `${row}: ${column}`;

/** The row and column a matrix value names, or null when it names none of them. */
export function cellOf(value: string, rows: string[], columns: string[]) {
  for (const r of rows) {
    if (!value.startsWith(`${r}: `)) continue;
    const c = value.slice(r.length + 2);
    if (columns.includes(c)) return { row: r, column: c };
  }
  return null;
}

/** Whether a ranking puts every option exactly once. */
export function isRanking(values: string[], options: string[]) {
  return values.length === options.length && new Set(values).size === values.length && values.every((v) => options.includes(v));
}
