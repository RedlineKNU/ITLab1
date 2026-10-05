export class AuthMiddleware {
  constructor(authService) {
    this.authService = authService;
  }

  verify = (req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Відсутній або некоректний токен' });
    }
    try {
      const { userId, login } = this.authService.verifyToken(token);
      req.userId = userId;
      req.userLogin = login;
      next();
    } catch (err) {
      res.status(err.status || 401).json({ error: err.message });
    }
  };

  // Attaches user if Bearer is present; never rejects anonymous requests
  // (controller handles alt auth like ?dl= tokens).
  optional = (req, _res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme === 'Bearer' && token) {
      try {
        const { userId, login } = this.authService.verifyToken(token);
        req.userId = userId;
        req.userLogin = login;
      } catch {
        // fall through
      }
    }
    next();
  };
}
