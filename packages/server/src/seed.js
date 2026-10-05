// Wipes DATA_DIR and seeds demo users + files for local development.
// Production uses SEED_DEMO=true, which keeps existing data.

import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.js';
import { createDb } from './db.js';
import { UserRepository } from './repositories/userRepository.js';
import { FileRepository } from './repositories/fileRepository.js';
import { AuthService } from './services/authService.js';
import { StorageService } from './services/storageService.js';
import { FileService } from './services/fileService.js';
import { seedDemoData, DEMO_FILES } from './seedData.js';

async function main() {
  const config = loadConfig();
  if (fs.existsSync(config.dataDir)) {
    for (const entry of fs.readdirSync(config.dataDir)) {
      fs.rmSync(path.join(config.dataDir, entry), { recursive: true, force: true });
    }
  }
  const db = createDb(config.dbPath);
  const userRepository = new UserRepository(db);
  const fileRepository = new FileRepository(db);
  const authService = new AuthService({ userRepository, jwtSecret: config.jwtSecret });
  const storageService = new StorageService({ storageDir: config.storageDir });
  const fileService = new FileService({ fileRepository, storageService });

  await seedDemoData({ authService, fileService, fileRepository, userRepository });

  console.log('Seed complete.');
  console.log('Users:\n  alice / alice123\n  bob   / bob123');
  console.log(`Files seeded for alice: ${DEMO_FILES.length}`);
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
