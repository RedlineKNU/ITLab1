import { describe, it, expect } from 'vitest';
import { compareFileLists } from '../src/sync.js';

const t = (iso) => iso;

describe('compareFileLists', () => {
  it('файл лише локально → upload', () => {
    const actions = compareFileLists(
      [{ name: 'a.txt', modifiedAt: t('2026-01-01T00:00:00Z') }],
      []
    );
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ kind: 'upload', name: 'a.txt', reason: 'only-local' });
  });

  it('файл лише на сервері → download', () => {
    const actions = compareFileLists(
      [],
      [{ id: 1, name: 'b.txt', modifiedAt: t('2026-01-01T00:00:00Z') }]
    );
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ kind: 'download', name: 'b.txt', reason: 'only-remote' });
  });

  it('локальна новіша → upload', () => {
    const actions = compareFileLists(
      [{ name: 'c.txt', modifiedAt: t('2026-02-01T00:00:00Z') }],
      [{ id: 2, name: 'c.txt', modifiedAt: t('2026-01-01T00:00:00Z') }]
    );
    expect(actions[0]).toMatchObject({ kind: 'upload', reason: 'local-newer' });
  });

  it('серверна новіша → download', () => {
    const actions = compareFileLists(
      [{ name: 'd.txt', modifiedAt: t('2026-01-01T00:00:00Z') }],
      [{ id: 3, name: 'd.txt', modifiedAt: t('2026-02-01T00:00:00Z') }]
    );
    expect(actions[0]).toMatchObject({ kind: 'download', reason: 'remote-newer' });
  });

  it('однакові дати (у межах толерантності) → skip', () => {
    const actions = compareFileLists(
      [{ name: 'e.txt', modifiedAt: t('2026-01-01T00:00:00Z') }],
      [{ id: 4, name: 'e.txt', modifiedAt: t('2026-01-01T00:00:01Z') }]
    );
    expect(actions[0]).toMatchObject({ kind: 'skip', reason: 'in-sync' });
  });

  it('комбінація багатьох файлів', () => {
    const actions = compareFileLists(
      [
        { name: 'a.txt', modifiedAt: t('2026-01-01T00:00:00Z') },
        { name: 'b.txt', modifiedAt: t('2026-02-01T00:00:00Z') },
        { name: 'c.txt', modifiedAt: t('2026-01-01T00:00:00Z') },
      ],
      [
        { id: 2, name: 'b.txt', modifiedAt: t('2026-01-01T00:00:00Z') },
        { id: 3, name: 'c.txt', modifiedAt: t('2026-02-01T00:00:00Z') },
        { id: 4, name: 'd.txt', modifiedAt: t('2026-01-01T00:00:00Z') },
      ]
    );
    const byName = Object.fromEntries(actions.map((a) => [a.name, a.kind]));
    expect(byName).toEqual({
      'a.txt': 'upload',
      'b.txt': 'upload',
      'c.txt': 'download',
      'd.txt': 'download',
    });
  });
});
