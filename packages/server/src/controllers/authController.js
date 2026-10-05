export class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  register = async (req, res) => {
    try {
      const user = await this.authService.register(req.body ?? {});
      res.status(201).json(user);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  };

  login = async (req, res) => {
    try {
      const result = await this.authService.login(req.body ?? {});
      res.status(200).json(result);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  };
}
