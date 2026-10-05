import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';

function tmpConfig() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-drive-test-'));
  return {
    port: 0,
    jwtSecret: 'api-test-secret',
    dataDir,
    storageDir: path.join(dataDir, 'storage'),
    dbPath: path.join(dataDir, 'db.sqlite'),
  };
}

async function registerAndLogin(app, login, password) {
  await request(app).post('/api/auth/register').send({ login, password }).expect(201);
  const res = await request(app).post('/api/auth/login').send({ login, password }).expect(200);
  return res.body.token;
}

describe('REST API', () => {
  let config;
  let app;

  beforeEach(() => {
    config = tmpConfig();
    ({ app } = createApp(config));
  });

  afterEach(() => {
    fs.rmSync(config.dataDir, { recursive: true, force: true });
  });

  it('повертає 401 без токена', async () => {
    await request(app).get('/api/files').expect(401);
  });

  it('upload з однаковою назвою оновлює modifiedBy', async () => {
    const aliceToken = await registerAndLogin(app, 'alice', 'alice123');
    const bobToken = await registerAndLogin(app, 'bob', 'bob123');

    // Both users upload a file; each sees only own.
    const upload1 = await request(app)
      .post('/api/files')
      .set('Authorization', `Bearer ${aliceToken}`)
      .attach('file', Buffer.from('v1'), 'shared.txt')
      .expect(201);
    expect(upload1.body.file.uploadedBy).toBe('alice');
    expect(upload1.body.file.modifiedBy).toBe('alice');

    // Alice overwrites her own file — modifiedBy stays alice but modifiedAt changes.
    const originalModified = upload1.body.file.modifiedAt;
    await new Promise((r) => setTimeout(r, 15));
    const upload2 = await request(app)
      .post('/api/files')
      .set('Authorization', `Bearer ${aliceToken}`)
      .attach('file', Buffer.from('v2 longer'), 'shared.txt')
      .expect(201);
    expect(upload2.body.file.id).toBe(upload1.body.file.id);
    expect(upload2.body.file.uploadedBy).toBe('alice');
    expect(upload2.body.file.modifiedBy).toBe('alice');
    expect(upload2.body.file.modifiedAt).not.toBe(originalModified);

    // Bob's upload with same name should go into bob's own namespace.
    const bobUpload = await request(app)
      .post('/api/files')
      .set('Authorization', `Bearer ${bobToken}`)
      .attach('file', Buffer.from('bob'), 'shared.txt')
      .expect(201);
    expect(bobUpload.body.file.uploadedBy).toBe('bob');

    // Bob cannot access alice's file by id.
    await request(app)
      .get(`/api/files/${upload1.body.file.id}/download`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(404);
  });

  it('файли різних користувачів ізольовані', async () => {
    const aliceToken = await registerAndLogin(app, 'alice', 'a');
    const bobToken = await registerAndLogin(app, 'bob', 'b');

    await request(app)
      .post('/api/files')
      .set('Authorization', `Bearer ${aliceToken}`)
      .attach('file', Buffer.from('a'), 'alice.txt');

    const bobList = await request(app)
      .get('/api/files')
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);
    expect(bobList.body.files).toHaveLength(0);
  });

  it('download повертає байти та заголовок імені', async () => {
    const token = await registerAndLogin(app, 'alice', 'a');
    const uploaded = await request(app)
      .post('/api/files')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('hello world'), 'greet.txt')
      .expect(201);
    const dl = await request(app)
      .get(`/api/files/${uploaded.body.file.id}/download`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(dl.body.toString('utf8')).toBe('hello world');
    expect(dl.headers['x-file-name']).toBe(encodeURIComponent('greet.txt'));
  });

  it('signed-url + ?dl= дозволяє скачати без заголовка Authorization', async () => {
    const token = await registerAndLogin(app, 'alice', 'a');
    const uploaded = await request(app)
      .post('/api/files')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('for-dl'), 'drag.bin')
      .expect(201);
    const id = uploaded.body.file.id;

    const signed = await request(app)
      .post(`/api/files/${id}/signed-url`)
      .set('Authorization', `Bearer ${token}`)
      .send({ ttlSeconds: 60 })
      .expect(200);
    expect(signed.body.url).toMatch(new RegExp(`^/api/files/${id}/download\\?dl=`));

    // No Authorization header — must still succeed with the dl token.
    const dl = await request(app).get(signed.body.url).expect(200);
    expect(dl.body.toString('utf8')).toBe('for-dl');
    expect(dl.headers['x-file-name']).toBe(encodeURIComponent('drag.bin'));
  });

  it('signed-url чужого файлу → 404', async () => {
    const aliceToken = await registerAndLogin(app, 'alice', 'a');
    const bobToken = await registerAndLogin(app, 'bob', 'b');
    const uploaded = await request(app)
      .post('/api/files')
      .set('Authorization', `Bearer ${aliceToken}`)
      .attach('file', Buffer.from('x'), 'private.bin')
      .expect(201);
    await request(app)
      .post(`/api/files/${uploaded.body.file.id}/signed-url`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(404);
  });

  it('download без Authorization і без dl-токена → 401', async () => {
    await request(app).get('/api/files/999/download').expect(401);
  });

  it('delete видаляє файл', async () => {
    const token = await registerAndLogin(app, 'alice', 'a');
    const uploaded = await request(app)
      .post('/api/files')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('tbd'), 'bye.txt');
    await request(app)
      .delete(`/api/files/${uploaded.body.file.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    const list = await request(app).get('/api/files').set('Authorization', `Bearer ${token}`);
    expect(list.body.files).toHaveLength(0);
  });
});
