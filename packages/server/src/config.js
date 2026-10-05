import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDataDir = path.resolve(__dirname, '..', 'data');

export function loadConfig(overrides = {}) {
  const dataDir = overrides.dataDir ?? process.env.DATA_DIR ?? defaultDataDir;
  const defaultWebDist = path.resolve(__dirname, '..', '..', 'web', 'dist');
  const webDistDir = overrides.webDistDir ?? process.env.WEB_DIST_DIR ?? defaultWebDist;
  return {
    port: Number(overrides.port ?? process.env.PORT ?? 3000),
    jwtSecret: overrides.jwtSecret ?? process.env.JWT_SECRET ?? 'dev-secret-change-me',
    dataDir: path.resolve(dataDir),
    storageDir: path.resolve(dataDir, 'storage'),
    dbPath: path.resolve(dataDir, 'mini-drive.sqlite'),
    webDistDir: webDistDir ? path.resolve(webDistDir) : null,
    seedDemo: (overrides.seedDemo ?? process.env.SEED_DEMO) === 'true',
  };
}
