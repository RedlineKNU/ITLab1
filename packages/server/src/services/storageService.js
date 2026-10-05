import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class StorageService {
  constructor({ storageDir }) {
    this.storageDir = storageDir;
    fs.mkdirSync(storageDir, { recursive: true });
  }

  _userDir(ownerId) {
    const dir = path.join(this.storageDir, String(ownerId));
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  write(ownerId, buffer) {
    const name = crypto.randomBytes(16).toString('hex');
    const dir = this._userDir(ownerId);
    const fullPath = path.join(dir, name);
    fs.writeFileSync(fullPath, buffer);
    return path.relative(this.storageDir, fullPath);
  }

  read(storagePath) {
    return fs.readFileSync(path.join(this.storageDir, storagePath));
  }

  stream(storagePath) {
    return fs.createReadStream(path.join(this.storageDir, storagePath));
  }

  remove(storagePath) {
    const target = path.join(this.storageDir, storagePath);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
}
