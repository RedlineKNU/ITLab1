export class FileRepository {
  constructor(db) {
    this.db = db;
  }

  _row(row) {
    if (!row) return null;
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      extension: row.extension,
      size: row.size,
      storagePath: row.storage_path,
      createdAt: row.created_at,
      modifiedAt: row.modified_at,
      uploadedBy: row.uploaded_by,
      modifiedBy: row.modified_by,
    };
  }

  findAllByOwner(ownerId) {
    const rows = this.db
      .prepare('SELECT * FROM files WHERE owner_id = ? ORDER BY name COLLATE NOCASE ASC')
      .all(ownerId);
    return rows.map((r) => this._row(r));
  }

  findByName(ownerId, name) {
    const row = this.db
      .prepare('SELECT * FROM files WHERE owner_id = ? AND name = ?')
      .get(ownerId, name);
    return this._row(row);
  }

  findByIdForOwner(ownerId, id) {
    const row = this.db
      .prepare('SELECT * FROM files WHERE owner_id = ? AND id = ?')
      .get(ownerId, id);
    return this._row(row);
  }

  insert(record) {
    const info = this.db
      .prepare(
        `INSERT INTO files
         (owner_id, name, extension, size, storage_path, created_at, modified_at, uploaded_by, modified_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        record.ownerId,
        record.name,
        record.extension,
        record.size,
        record.storagePath,
        record.createdAt,
        record.modifiedAt,
        record.uploadedBy,
        record.modifiedBy
      );
    return { ...record, id: info.lastInsertRowid };
  }

  update(id, patch) {
    const current = this.db.prepare('SELECT * FROM files WHERE id = ?').get(id);
    if (!current) return null;
    const merged = {
      size: patch.size ?? current.size,
      storage_path: patch.storagePath ?? current.storage_path,
      modified_at: patch.modifiedAt ?? current.modified_at,
      modified_by: patch.modifiedBy ?? current.modified_by,
      extension: patch.extension ?? current.extension,
    };
    this.db
      .prepare(
        `UPDATE files SET size = ?, storage_path = ?, modified_at = ?, modified_by = ?, extension = ? WHERE id = ?`
      )
      .run(merged.size, merged.storage_path, merged.modified_at, merged.modified_by, merged.extension, id);
    return this._row(this.db.prepare('SELECT * FROM files WHERE id = ?').get(id));
  }

  delete(id) {
    this.db.prepare('DELETE FROM files WHERE id = ?').run(id);
  }
}
