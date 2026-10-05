import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';

import { createDb } from './db.js';
import { UserRepository } from './repositories/userRepository.js';
import { FileRepository } from './repositories/fileRepository.js';
import { AuthService } from './services/authService.js';
import { StorageService } from './services/storageService.js';
import { FileService } from './services/fileService.js';
import { AuthMiddleware } from './middleware/auth.js';
import { AuthController } from './controllers/authController.js';
import { FileController } from './controllers/fileController.js';

export function createApp(config) {
  const db = createDb(config.dbPath);
  const userRepository = new UserRepository(db);
  const fileRepository = new FileRepository(db);
  const authService = new AuthService({ userRepository, jwtSecret: config.jwtSecret });
  const storageService = new StorageService({ storageDir: config.storageDir });
  const fileService = new FileService({ fileRepository, storageService });
  const authMiddleware = new AuthMiddleware(authService);
  const authController = new AuthController(authService);
  const fileController = new FileController(fileService, authService);

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

  const app = express();
  app.use(cors({ exposedHeaders: ['X-File-Name', 'X-File-Modified-At'] }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.post('/api/auth/register', authController.register);
  app.post('/api/auth/login', authController.login);

  app.get('/api/files', authMiddleware.verify, fileController.list);
  app.post('/api/files', authMiddleware.verify, upload.single('file'), fileController.upload);
  app.post('/api/files/:id/signed-url', authMiddleware.verify, fileController.signedUrl);
  // Dual-auth: Authorization header OR ?dl=<short-lived JWT> for drag-out.
  app.get('/api/files/:id/download', authMiddleware.optional, fileController.download);
  app.delete('/api/files/:id', authMiddleware.verify, fileController.remove);

  if (config.webDistDir) {
    const webDir = config.webDistDir;
    if (fs.existsSync(webDir)) {
      app.use(express.static(webDir, { index: false, maxAge: '1h' }));
      app.get(/^(?!\/api\/).*/, (req, res, next) => {
        const indexFile = path.join(webDir, 'index.html');
        if (!fs.existsSync(indexFile)) return next();
        res.sendFile(indexFile);
      });
    }
  }

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Internal error' });
  });

  return { app, db, services: { authService, fileService, storageService, userRepository } };
}
