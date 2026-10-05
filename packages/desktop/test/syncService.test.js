import { describe, it, expect } from 'vitest';
import { compareFileLists as localCompare } from '../src/main/syncService.js';
import { compareFileLists as sharedCompare } from '@mini-drive/shared/sync';

// After stage 3 the pure compare lives in @mini-drive/shared/sync.
// Keep a sanity check so a bad desktop re-export surfaces immediately.
describe('desktop → shared compare bridge', () => {
  it('desktop re-export points to the shared implementation', () => {
    expect(localCompare).toBe(sharedCompare);
  });

  it('still produces the expected upload/download verdict for a mixed set', () => {
    const actions = localCompare(
      [{ name: 'only-local.txt', modifiedAt: '2026-01-01T00:00:00Z' }],
      [{ id: 7, name: 'only-remote.txt', modifiedAt: '2026-01-01T00:00:00Z' }]
    );
    const byName = Object.fromEntries(actions.map((a) => [a.name, a.kind]));
    expect(byName).toEqual({ 'only-local.txt': 'upload', 'only-remote.txt': 'download' });
  });
});
