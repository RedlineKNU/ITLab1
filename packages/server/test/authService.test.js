import { describe, it, expect, beforeEach } from 'vitest';
import { createDb } from '../src/db.js';
import { UserRepository } from '../src/repositories/userRepository.js';
import { AuthService } from '../src/services/authService.js';

function makeService() {
  const db = createDb(':memory:');
  const userRepository = new UserRepository(db);
  const authService = new AuthService({ userRepository, jwtSecret: 'test-secret' });
  return { authService, userRepository, db };
}

describe('AuthService', () => {
  let ctx;
  beforeEach(() => {
    ctx = makeService();
  });

  it('зберігає пароль у вигляді хешу, а не відкритим текстом', async () => {
    await ctx.authService.register({ login: 'alice', password: 'secret-pw' });
    const stored = ctx.userRepository.findByLogin('alice');
    expect(stored.passwordHash).toBeDefined();
    expect(stored.passwordHash).not.toBe('secret-pw');
    expect(stored.passwordHash.length).toBeGreaterThan(20);
  });

  it('повертає токен за правильного пароля', async () => {
    await ctx.authService.register({ login: 'alice', password: 'secret-pw' });
    const result = await ctx.authService.login({ login: 'alice', password: 'secret-pw' });
    expect(result.token).toEqual(expect.any(String));
    expect(result.user.login).toBe('alice');
  });

  it('кидає помилку за неправильного пароля', async () => {
    await ctx.authService.register({ login: 'alice', password: 'secret-pw' });
    await expect(
      ctx.authService.login({ login: 'alice', password: 'wrong' })
    ).rejects.toMatchObject({ status: 401 });
  });

  it('verifyToken повертає userId за валідного токена', async () => {
    await ctx.authService.register({ login: 'alice', password: 'secret-pw' });
    const { token, user } = await ctx.authService.login({ login: 'alice', password: 'secret-pw' });
    const payload = ctx.authService.verifyToken(token);
    expect(payload.userId).toBe(user.id);
    expect(payload.login).toBe('alice');
  });

  it('verifyToken кидає помилку для сміттєвого токена', () => {
    expect(() => ctx.authService.verifyToken('not-a-token')).toThrowError();
  });

  it('не дозволяє реєструвати двох користувачів з однаковим логіном', async () => {
    await ctx.authService.register({ login: 'alice', password: '123' });
    await expect(ctx.authService.register({ login: 'alice', password: '456' })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('signDownloadToken + verifyDownloadToken повертають fileId/userId', () => {
    const token = ctx.authService.signDownloadToken({ fileId: 42, userId: 7, login: 'alice' });
    const payload = ctx.authService.verifyDownloadToken(token, { expectedFileId: 42 });
    expect(payload).toMatchObject({ fileId: 42, userId: 7, login: 'alice' });
  });

  it('verifyDownloadToken кидає помилку для чужого fileId', () => {
    const token = ctx.authService.signDownloadToken({ fileId: 1, userId: 1, login: 'alice' });
    expect(() => ctx.authService.verifyDownloadToken(token, { expectedFileId: 2 })).toThrowError();
  });

  it('verifyDownloadToken не приймає звичайний access-токен', async () => {
    await ctx.authService.register({ login: 'alice', password: 'x' });
    const { token } = await ctx.authService.login({ login: 'alice', password: 'x' });
    expect(() => ctx.authService.verifyDownloadToken(token)).toThrowError();
  });
});
