export class UserRepository {
  constructor(db) {
    this.db = db;
  }

  findByLogin(login) {
    const row = this.db
      .prepare('SELECT id, login, password_hash AS passwordHash, created_at AS createdAt FROM users WHERE login = ?')
      .get(login);
    return row ?? null;
  }

  findById(id) {
    const row = this.db
      .prepare('SELECT id, login, password_hash AS passwordHash, created_at AS createdAt FROM users WHERE id = ?')
      .get(id);
    return row ?? null;
  }

  create({ login, passwordHash, createdAt }) {
    const info = this.db
      .prepare('INSERT INTO users (login, password_hash, created_at) VALUES (?, ?, ?)')
      .run(login, passwordHash, createdAt);
    return { id: info.lastInsertRowid, login, passwordHash, createdAt };
  }
}
