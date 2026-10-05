export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export class MainApiClient {
  constructor({ baseUrl, token = null } = {}) {
    this.baseUrl = (baseUrl || '').replace(/\/$/, '');
    this.token = token;
  }

  configure({ baseUrl, token }) {
    if (baseUrl !== undefined) this.baseUrl = (baseUrl || '').replace(/\/$/, '');
    if (token !== undefined) this.token = token;
  }

  _url(p) {
    return `${this.baseUrl}${p.startsWith('/') ? p : `/${p}`}`;
  }

  _headers(extra = {}) {
    const h = { ...extra };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  async _handle(res) {
    if (res.status === 204) return null;
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new ApiError(data?.error || `HTTP ${res.status}`, res.status);
    return data;
  }

  async listFiles() {
    const res = await fetch(this._url('/api/files'), { headers: this._headers() });
    const data = await this._handle(res);
    return data?.files ?? [];
  }

  async uploadFile(name, buffer) {
    const form = new FormData();
    form.append('name', name);
    form.append('file', new Blob([buffer]), name);
    const res = await fetch(this._url('/api/files'), {
      method: 'POST',
      headers: this._headers(),
      body: form,
    });
    const data = await this._handle(res);
    return data?.file ?? data;
  }

  async downloadFile(id) {
    const res = await fetch(this._url(`/api/files/${id}/download`), { headers: this._headers() });
    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(text || `HTTP ${res.status}`, res.status);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const name = decodeURIComponent(res.headers.get('x-file-name') || '');
    const modifiedAt = res.headers.get('x-file-modified-at') || null;
    return { buffer, name, modifiedAt };
  }

  async deleteFile(id) {
    const res = await fetch(this._url(`/api/files/${id}`), {
      method: 'DELETE',
      headers: this._headers(),
    });
    return this._handle(res);
  }
}
