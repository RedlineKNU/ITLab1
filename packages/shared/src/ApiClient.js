export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export class ApiClient {
  constructor({ baseUrl, token = null, fetchImpl = globalThis.fetch } = {}) {
    this.baseUrl = (baseUrl || '').replace(/\/$/, '');
    this.token = token;
    this.fetchImpl = fetchImpl.bind(globalThis);
  }

  setToken(token) {
    this.token = token;
  }

  _url(path) {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  _headers(extra = {}) {
    const headers = { ...extra };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  }

  async _handle(res) {
    if (res.status === 204) return null;
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const message = data?.error || `HTTP ${res.status}`;
      throw new ApiError(message, res.status);
    }
    return data;
  }

  async register(login, password) {
    const res = await this.fetchImpl(this._url('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    });
    return this._handle(res);
  }

  async login(login, password) {
    const res = await this.fetchImpl(this._url('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    });
    const data = await this._handle(res);
    if (data?.token) this.setToken(data.token);
    return data;
  }

  async listFiles() {
    const res = await this.fetchImpl(this._url('/api/files'), {
      headers: this._headers(),
    });
    const data = await this._handle(res);
    return data?.files ?? [];
  }

  async uploadFile(name, data) {
    let blobLike;
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      blobLike = data;
    } else if (data instanceof ArrayBuffer) {
      blobLike = new Blob([data]);
    } else if (ArrayBuffer.isView(data)) {
      blobLike = new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)]);
    } else {
      blobLike = new Blob([data]);
    }
    const form = new FormData();
    form.append('name', name);
    form.append('file', blobLike, name);
    const res = await this.fetchImpl(this._url('/api/files'), {
      method: 'POST',
      headers: this._headers(),
      body: form,
    });
    const result = await this._handle(res);
    return result?.file ?? result;
  }

  async downloadFile(id) {
    const res = await this.fetchImpl(this._url(`/api/files/${id}/download`), {
      headers: this._headers(),
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(text || `HTTP ${res.status}`, res.status);
    }
    const buffer = new Uint8Array(await res.arrayBuffer());
    const name = decodeURIComponent(res.headers.get('x-file-name') || '');
    const modifiedAt = res.headers.get('x-file-modified-at') || null;
    return { buffer, name, modifiedAt };
  }

  async deleteFile(id) {
    const res = await this.fetchImpl(this._url(`/api/files/${id}`), {
      method: 'DELETE',
      headers: this._headers(),
    });
    return this._handle(res);
  }
}
