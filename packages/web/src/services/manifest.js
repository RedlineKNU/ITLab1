import { openDB } from 'idb';

const DB_NAME = 'mini-drive-web';
const DB_VERSION = 1;
const STORE_KV = 'kv';
const STORE_MANIFEST = 'manifest';

let dbPromise;

function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(upgradeDb) {
        if (!upgradeDb.objectStoreNames.contains(STORE_KV)) {
          upgradeDb.createObjectStore(STORE_KV);
        }
        if (!upgradeDb.objectStoreNames.contains(STORE_MANIFEST)) {
          upgradeDb.createObjectStore(STORE_MANIFEST);
        }
      },
    });
  }
  return dbPromise;
}

export async function saveKv(key, value) {
  const d = await db();
  await d.put(STORE_KV, value, key);
}

export async function readKv(key) {
  const d = await db();
  return d.get(STORE_KV, key);
}

export async function deleteKv(key) {
  const d = await db();
  await d.delete(STORE_KV, key);
}

export async function readManifest() {
  const d = await db();
  const keys = await d.getAllKeys(STORE_MANIFEST);
  const vals = await d.getAll(STORE_MANIFEST);
  const out = {};
  keys.forEach((k, i) => {
    out[k] = vals[i];
  });
  return out;
}

export async function writeManifestEntry(name, entry) {
  const d = await db();
  await d.put(STORE_MANIFEST, entry, name);
}

export async function deleteManifestEntry(name) {
  const d = await db();
  await d.delete(STORE_MANIFEST, name);
}

export async function clearManifest() {
  const d = await db();
  await d.clear(STORE_MANIFEST);
}
