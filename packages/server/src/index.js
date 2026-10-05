import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { seedDemoData } from './seedData.js';

async function maybeAutoSeed({ db, services, config }) {
  if (!config.seedDemo) return;
  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (userCount > 0) {
    console.log('[seed] SEED_DEMO=true, але користувачі вже існують — пропускаю.');
    return;
  }
  console.log('[seed] SEED_DEMO=true, користувачів немає — створюю демо-дані.');
  const { authService, fileService, userRepository } = services;
  await seedDemoData({
    authService,
    fileService,
    fileRepository: fileService.fileRepository,
    userRepository,
  });
  console.log('[seed] Готово.');
}

async function main() {
  const config = loadConfig();
  const { app, db, services } = createApp(config);

  await maybeAutoSeed({ db, services, config });

  app.listen(config.port, () => {
    console.log(`Mini Drive API listening on http://localhost:${config.port}`);
    console.log(`Data directory: ${config.dataDir}`);
    if (config.webDistDir) {
      console.log(`Web client dir: ${config.webDistDir}`);
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
