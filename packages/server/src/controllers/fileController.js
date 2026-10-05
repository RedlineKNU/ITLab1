export class FileController {
  constructor(fileService, authService) {
    this.fileService = fileService;
    this.authService = authService;
  }

  list = (req, res) => {
    try {
      const files = this.fileService.list(req.userId);
      res.json({ files });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  };

  upload = async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Файл не передано' });
      }
      const name = req.body?.name || req.file.originalname;
      const record = await this.fileService.save({
        ownerId: req.userId,
        ownerLogin: req.userLogin,
        name,
        buffer: req.file.buffer,
      });
      res.status(201).json({ file: record });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  };

  download = (req, res) => {
    try {
      const id = Number(req.params.id);
      let ownerId = req.userId;
      if (!ownerId && req.query?.dl) {
        const payload = this.authService.verifyDownloadToken(req.query.dl, { expectedFileId: id });
        ownerId = payload.userId;
      }
      if (!ownerId) {
        return res.status(401).json({ error: 'Потрібна авторизація' });
      }
      const { record, stream } = this.fileService.getStream(ownerId, id);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(record.name)}`
      );
      res.setHeader('X-File-Name', encodeURIComponent(record.name));
      res.setHeader('X-File-Modified-At', record.modifiedAt);
      stream.pipe(res);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  };

  signedUrl = (req, res) => {
    try {
      const id = Number(req.params.id);
      const record = this.fileService.getRecord(req.userId, id);
      const ttlSeconds = Math.min(Math.max(Number(req.body?.ttlSeconds) || 60, 10), 300);
      const token = this.authService.signDownloadToken({
        fileId: id,
        userId: req.userId,
        login: req.userLogin,
        ttlSeconds,
      });
      const url = `/api/files/${id}/download?dl=${encodeURIComponent(token)}`;
      res.json({
        url,
        token,
        name: record.name,
        size: record.size,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  };

  remove = (req, res) => {
    try {
      const id = Number(req.params.id);
      this.fileService.delete(req.userId, id);
      res.status(204).end();
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  };
}
