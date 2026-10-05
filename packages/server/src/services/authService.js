import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export class AuthService {
  constructor({ userRepository, jwtSecret, tokenTtl = '7d' }) {
    this.userRepository = userRepository;
    this.jwtSecret = jwtSecret;
    this.tokenTtl = tokenTtl;
  }

  async register({ login, password }) {
    if (!login || !password) {
      throw Object.assign(new Error('Логін і пароль обов’язкові'), { status: 400 });
    }
    const existing = this.userRepository.findByLogin(login);
    if (existing) {
      throw Object.assign(new Error('Користувач з таким логіном уже існує'), { status: 409 });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const createdAt = new Date().toISOString();
    const user = this.userRepository.create({ login, passwordHash, createdAt });
    return { id: user.id, login: user.login, createdAt };
  }

  async login({ login, password }) {
    const user = this.userRepository.findByLogin(login);
    if (!user) {
      throw Object.assign(new Error('Невірний логін або пароль'), { status: 401 });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw Object.assign(new Error('Невірний логін або пароль'), { status: 401 });
    }
    const token = jwt.sign({ sub: user.id, login: user.login }, this.jwtSecret, {
      expiresIn: this.tokenTtl,
    });
    return { token, user: { id: user.id, login: user.login } };
  }

  verifyToken(token) {
    try {
      const payload = jwt.verify(token, this.jwtSecret);
      return { userId: payload.sub, login: payload.login };
    } catch (err) {
      throw Object.assign(new Error('Недійсний токен'), { status: 401 });
    }
  }

  // DownloadURL dataTransfer can't carry Authorization — pass the token via query string.
  signDownloadToken({ fileId, userId, login, ttlSeconds = 60 }) {
    return jwt.sign(
      { dl: true, fileId, sub: userId, login },
      this.jwtSecret,
      { expiresIn: ttlSeconds }
    );
  }

  verifyDownloadToken(token, { expectedFileId } = {}) {
    let payload;
    try {
      payload = jwt.verify(token, this.jwtSecret);
    } catch {
      throw Object.assign(new Error('Недійсний або прострочений токен завантаження'), { status: 401 });
    }
    if (!payload?.dl) {
      throw Object.assign(new Error('Токен не призначений для завантаження'), { status: 401 });
    }
    if (expectedFileId !== undefined && Number(payload.fileId) !== Number(expectedFileId)) {
      throw Object.assign(new Error('Токен не відповідає запитаному файлу'), { status: 401 });
    }
    return { fileId: payload.fileId, userId: payload.sub, login: payload.login };
  }
}
