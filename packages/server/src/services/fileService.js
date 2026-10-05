import path from 'node:path';

function extensionOf(name) {
  const ext = path.extname(name).toLowerCase();
  return ext.startsWith('.') ? ext.slice(1) : ext;
}

export class FileService {
  constructor({ fileRepository, storageService }) {
    this.fileRepository = fileRepository;
    this.storageService = storageService;
  }

  list(ownerId) {
    return this.fileRepository.findAllByOwner(ownerId);
  }

  async save({ ownerId, ownerLogin, name, buffer }) {
    if (!name) {
      throw Object.assign(new Error('Назва файлу обов’язкова'), { status: 400 });
    }
    const existing = this.fileRepository.findByName(ownerId, name);
    const now = new Date().toISOString();
    const storagePath = this.storageService.write(ownerId, buffer);
    const extension = extensionOf(name);

    if (existing) {
      this.storageService.remove(existing.storagePath);
      return this.fileRepository.update(existing.id, {
        size: buffer.length,
        storagePath,
        modifiedAt: now,
        modifiedBy: ownerLogin,
        extension,
      });
    }

    return this.fileRepository.insert({
      ownerId,
      name,
      extension,
      size: buffer.length,
      storagePath,
      createdAt: now,
      modifiedAt: now,
      uploadedBy: ownerLogin,
      modifiedBy: ownerLogin,
    });
  }

  getRecord(ownerId, id) {
    const record = this.fileRepository.findByIdForOwner(ownerId, id);
    if (!record) {
      throw Object.assign(new Error('Файл не знайдено'), { status: 404 });
    }
    return record;
  }

  getStream(ownerId, id) {
    const record = this.fileRepository.findByIdForOwner(ownerId, id);
    if (!record) {
      throw Object.assign(new Error('Файл не знайдено'), { status: 404 });
    }
    return { record, stream: this.storageService.stream(record.storagePath) };
  }

  getBuffer(ownerId, id) {
    const record = this.fileRepository.findByIdForOwner(ownerId, id);
    if (!record) {
      throw Object.assign(new Error('Файл не знайдено'), { status: 404 });
    }
    return { record, buffer: this.storageService.read(record.storagePath) };
  }

  delete(ownerId, id) {
    const record = this.fileRepository.findByIdForOwner(ownerId, id);
    if (!record) {
      throw Object.assign(new Error('Файл не знайдено'), { status: 404 });
    }
    this.storageService.remove(record.storagePath);
    this.fileRepository.delete(record.id);
  }
}
