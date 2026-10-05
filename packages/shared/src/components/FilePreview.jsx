import React, { useEffect, useState } from 'react';

function extension(name) {
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase();
}

function bufferToText(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(bytes);
  }
  // Fallback for environments without TextDecoder.
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return s;
}

function bufferToDataUrl(buffer, mime) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  const base64 = typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bytes).toString('base64');
  return `data:${mime};base64,${base64}`;
}

export function FilePreview({ file, loading, buffer }) {
  const [preview, setPreview] = useState({ kind: 'none' });

  useEffect(() => {
    if (!file || !buffer) {
      setPreview({ kind: 'none' });
      return;
    }
    const ext = extension(file.name);
    if (ext === 'html') {
      setPreview({ kind: 'text', content: bufferToText(buffer) });
    } else if (ext === 'png') {
      setPreview({ kind: 'image', url: bufferToDataUrl(buffer, 'image/png') });
    } else {
      setPreview({ kind: 'unsupported' });
    }
  }, [file?.id, buffer]);

  if (!file) {
    return (
      <div className="preview empty" data-testid="preview">
        <p className="muted">Оберіть файл, щоб побачити вміст.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="preview" data-testid="preview">
        <p>Завантаження вмісту…</p>
      </div>
    );
  }

  return (
    <div className="preview" data-testid="preview">
      <header>
        <h3>{file.name}</h3>
      </header>
      {preview.kind === 'text' ? (
        <pre data-testid="preview-text">{preview.content}</pre>
      ) : null}
      {preview.kind === 'image' ? (
        <img src={preview.url} alt={file.name} data-testid="preview-image" />
      ) : null}
      {preview.kind === 'unsupported' ? (
        <p className="muted" data-testid="preview-unsupported">
          Перегляд не підтримується.
        </p>
      ) : null}
    </div>
  );
}
