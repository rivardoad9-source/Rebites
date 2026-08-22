import { deriveSnapshot } from './derive';
import { readAll } from './store';
import type { Snapshot } from './types';

/** Ambil seluruh data dari sumber aktif, jalankan FIFO, turunkan metrik. */
export async function getSnapshot(now = new Date()): Promise<Snapshot> {
  return deriveSnapshot(await readAll(), now);
}
