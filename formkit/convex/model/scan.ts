/**
 * Reading a long list a page at a time without reading all of it: admin
 * lists walk an index, keep the rows that pass their filters, and stop after
 * a page or after `cap` rows, handing back where to carry on.
 */

/** Two streams already in the same order, as one. */
export async function* mergeSorted<T>(
  a: AsyncIterable<T>,
  b: AsyncIterable<T>,
  before: (x: T, y: T) => boolean,
): AsyncGenerator<T> {
  const ia = a[Symbol.asyncIterator]();
  const ib = b[Symbol.asyncIterator]();
  let x = await ia.next();
  let y = await ib.next();
  while (!x.done || !y.done) {
    if (y.done || (!x.done && before(x.value, y.value))) {
      yield x.value;
      x = await ia.next();
    } else {
      yield y.value;
      y = await ib.next();
    }
  }
}

/**
 * Up to `want` rows of `source` that `keep` passes. `next` is the cursor of
 * the last row taken, or of the last row read when `cap` rows were read first;
 * null when the source ran out.
 */
export async function scanPage<T, R>(
  source: AsyncIterable<T>,
  keep: (item: T) => Promise<R | null> | R | null,
  cursorOf: (item: T) => string,
  want: number,
  cap: number,
): Promise<{ rows: R[]; next: string | null }> {
  const rows: R[] = [];
  let read = 0;
  let last: T | null = null;
  for await (const item of source) {
    if (++read > cap) return { rows, next: last ? cursorOf(last) : null };
    const row = await keep(item);
    if (row !== null) {
      if (rows.length === want) return { rows, next: last ? cursorOf(last) : null };
      rows.push(row);
    }
    last = item;
  }
  return { rows, next: null };
}
