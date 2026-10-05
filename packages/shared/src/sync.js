export const SYNC_STATES = {
  SYNCED: 'SYNCED',
  LOCAL_MODIFIED: 'LOCAL_MODIFIED',
  REMOTE_MODIFIED: 'REMOTE_MODIFIED',
  CONFLICT: 'CONFLICT',
  UPLOADING: 'UPLOADING',
  DOWNLOADING: 'DOWNLOADING',
  ERROR: 'ERROR',
};

export function compareFileLists(local, remote, { toleranceMs = 2000 } = {}) {
  const actions = [];
  const byName = new Map();
  for (const file of local) byName.set(file.name, { local: file });
  for (const file of remote) {
    const entry = byName.get(file.name) || {};
    entry.remote = file;
    byName.set(file.name, entry);
  }
  for (const [name, { local: l, remote: r }] of byName) {
    if (l && !r) {
      actions.push({ name, kind: 'upload', reason: 'only-local', local: l });
    } else if (!l && r) {
      actions.push({ name, kind: 'download', reason: 'only-remote', remote: r });
    } else if (l && r) {
      const lt = new Date(l.modifiedAt).getTime();
      const rt = new Date(r.modifiedAt).getTime();
      const diff = lt - rt;
      if (Math.abs(diff) <= toleranceMs) {
        actions.push({ name, kind: 'skip', reason: 'in-sync', local: l, remote: r });
      } else if (diff > 0) {
        actions.push({ name, kind: 'upload', reason: 'local-newer', local: l, remote: r });
      } else {
        actions.push({ name, kind: 'download', reason: 'remote-newer', local: l, remote: r });
      }
    }
  }
  return actions;
}
