import { describe, it, expect } from 'vitest';
import { FileQueryService } from '../src/FileQueryService.js';

const sample = [
  { id: 1, name: 'readme.cpp' },
  { id: 2, name: 'logo.png' },
  { id: 3, name: 'index.html' },
  { id: 4, name: 'notes.txt' },
  { id: 5, name: 'SCREEN.PNG' },
  { id: 6, name: 'util.js' },
  { id: 7, name: 'Makefile' }, // no extension
];

describe('FileQueryService.sortByName', () => {
  it('сортує за зростанням без урахування регістру', () => {
    const sorted = FileQueryService.sortByName(sample, 'asc');
    expect(sorted.map((f) => f.name)).toEqual([
      'index.html',
      'logo.png',
      'Makefile',
      'notes.txt',
      'readme.cpp',
      'SCREEN.PNG',
      'util.js',
    ]);
  });

  it('сортує за спаданням', () => {
    const sorted = FileQueryService.sortByName(sample, 'desc');
    expect(sorted.map((f) => f.name)).toEqual([
      'util.js',
      'SCREEN.PNG',
      'readme.cpp',
      'notes.txt',
      'Makefile',
      'logo.png',
      'index.html',
    ]);
  });

  it('не мутує вхідний масив', () => {
    const copy = [...sample];
    FileQueryService.sortByName(sample, 'desc');
    expect(sample).toEqual(copy);
  });
});

describe('FileQueryService.filterByType', () => {
  it('all повертає всі файли', () => {
    expect(FileQueryService.filterByType(sample, 'all')).toHaveLength(sample.length);
  });

  it('cpp_png залишає лише .cpp та .png (без урахування регістру)', () => {
    const filtered = FileQueryService.filterByType(sample, 'cpp_png');
    expect(filtered.map((f) => f.name).sort()).toEqual(['SCREEN.PNG', 'logo.png', 'readme.cpp'].sort());
  });

  it('cpp_png відкидає .html, .txt, .js та файли без розширення', () => {
    const filtered = FileQueryService.filterByType(sample, 'cpp_png');
    const names = filtered.map((f) => f.name);
    expect(names).not.toContain('index.html');
    expect(names).not.toContain('notes.txt');
    expect(names).not.toContain('util.js');
    expect(names).not.toContain('Makefile');
  });

  it('не мутує вхідний масив', () => {
    const copy = [...sample];
    FileQueryService.filterByType(sample, 'cpp_png');
    expect(sample).toEqual(copy);
  });
});

describe('FileQueryService.apply (композиція)', () => {
  it('спершу фільтрує, потім сортує', () => {
    const result = FileQueryService.apply(sample, { filter: 'cpp_png', sort: 'asc' });
    expect(result.map((f) => f.name)).toEqual(['logo.png', 'readme.cpp', 'SCREEN.PNG']);
  });

  it('дозволяє одночасний фільтр і зворотне сортування', () => {
    const result = FileQueryService.apply(sample, { filter: 'cpp_png', sort: 'desc' });
    expect(result.map((f) => f.name)).toEqual(['SCREEN.PNG', 'readme.cpp', 'logo.png']);
  });
});
