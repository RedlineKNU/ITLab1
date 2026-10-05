function extensionLower(name) {
  if (!name) return '';
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return '';
  return name.slice(dot + 1).toLowerCase();
}

export const FileQueryService = {
  sortByName(files, direction = 'asc') {
    const sign = direction === 'desc' ? -1 : 1;
    return [...files].sort((a, b) => {
      const an = (a.name || '').toLowerCase();
      const bn = (b.name || '').toLowerCase();
      if (an < bn) return -1 * sign;
      if (an > bn) return 1 * sign;
      return 0;
    });
  },

  filterByType(files, mode = 'all') {
    if (mode === 'all') return [...files];
    if (mode === 'cpp_png') {
      return files.filter((f) => {
        const ext = extensionLower(f.name);
        return ext === 'cpp' || ext === 'png';
      });
    }
    return [...files];
  },

  apply(files, { filter = 'all', sort = 'asc' } = {}) {
    return FileQueryService.sortByName(FileQueryService.filterByType(files, filter), sort);
  },
};
