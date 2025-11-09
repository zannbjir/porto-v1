import fetch from 'node-fetch';
import FormData from 'form-data';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// --- mime -> ext
const MIME_EXT_MAP = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'application/octet-stream': 'bin',
};

function safeExt({ mime, originalName }) {
  if (originalName) {
    const e = path.extname(originalName).replace('.', '').toLowerCase();
    if (e) return e;
  }
  if (mime && MIME_EXT_MAP[mime]) return MIME_EXT_MAP[mime];
  if (mime && mime.includes('/')) {
    const guess = mime.split('/')[1].split(';')[0].trim();
    if (guess) return guess;
  }
  return 'bin';
}

// === Provider implementations (semua dari Buffer, tanpa file sementara) ===

async function CatboxUpload(buffer, filename) {
  const form = new FormData();
  form.append('fileToUpload', buffer, filename);
  form.append('reqtype', 'fileupload');

  const res = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  });

  const text = await res.text();
  if (!res.ok || !/^https?:\/\//.test(text)) {
    throw new Error(`catbox upload gagal: ${res.status} ${text}`);
  }
  return text.trim();
}

// Tmpfiles API v1 (stabil) — POST file ke /api/v1/upload
async function TmpfilesUpload(buffer, filename) {
  const form = new FormData();
  form.append('file', buffer, filename);

  const res = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  });

  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`tmpfiles upload gagal: ${res.status} ${msg}`);
  }

  let url =
    body?.url ||
    body?.data?.url ||
    (typeof body === 'string' && /^https?:\/\//i.test(body) ? body : null);

  if (!url) {
    throw new Error(`respon tmpfiles tidak berisi url: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }

  // normalisasi ke direct link jika format /download/
  if (url.includes('/download/')) url = url.replace('/download/', '/dl/');
  if (!/^https?:\/\//i.test(url)) url = 'https://tmpfiles.org' + url;

  return url;
}

async function UguuUpload(buffer, filename) {
  const form = new FormData();
  form.append('files[]', buffer, filename);

  const res = await fetch('https://uguu.se/upload', {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  });

  const ct = res.headers.get('content-type') || '';
  const raw = ct.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = typeof raw === 'string' ? raw : JSON.stringify(raw);
    throw new Error(`uguu upload gagal: ${res.status} ${msg}`);
  }

  // [{ name, url, ... }] atau { files: [...] } atau string url
  let arr = [];
  if (Array.isArray(raw)) arr = raw;
  else if (raw && Array.isArray(raw.files)) arr = raw.files;

  if (arr.length && arr[0]?.url) return arr[0].url;
  if (typeof raw === 'string' && raw.startsWith('http')) return raw.trim();

  throw new Error(`respon uguu tidak dikenal: ${typeof raw === 'string' ? raw : JSON.stringify(raw)}`);
}

async function CihuyUpload(buffer, filename) {
  const form = new FormData();
  form.append('file', buffer, filename);
  form.append('key', '220109'); // public key

  const headers = { ...form.getHeaders() };
  delete headers.authorization;
  delete headers.Authorization;

  const res = await fetch('https://cihuy.biz.id/api/upload', {
    method: 'POST',
    body: form,
    headers,
  });

  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`cihuy upload gagal: ${res.status} ${msg}`);
  }

  const urlPath = body?.url;
  if (!urlPath) throw new Error(`respon cihuy tidak berisi url: ${JSON.stringify(body)}`);

  return urlPath.startsWith('http') ? urlPath : `https://cihuy.biz.id${urlPath}`;
}

async function ZannUpload(buffer, filename) {
  const form = new FormData();
  form.append('file', buffer, filename);

  const res = await fetch('https://zann.web.id/upload', {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  });

  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    throw new Error(`zann upload gagal: ${res.status} ${msg}`);
  }

  const url =
    data?.url ||
    data?.data?.url ||
    (typeof data === 'string' && /^https?:\/\//.test(data) ? data : null);

  if (!url) throw new Error(`respon zann tidak berisi url: ${JSON.stringify(data)}`);
  return url;
}

// === Handler (dipanggil dari router) ===
export async function handleUpload(base64, apiType, options = {}) {
  if (typeof base64 !== 'string' || !base64.startsWith('data:')) {
    throw new Error('Data base64 tidak valid');
  }

  const m = base64.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error('Format base64 tidak valid');
  const mime = m[1];
  const b64 = m[2];

  const ext = safeExt({ mime, originalName: options.originalName });
  const buffer = Buffer.from(b64, 'base64');
  const filename = `${uuidv4()}.${ext}`;

  let link;
  if (apiType === 'tmpfiles') link = await TmpfilesUpload(buffer, filename);
  else if (apiType === 'uguu') link = await UguuUpload(buffer, filename);
  else if (apiType === 'cihuy') link = await CihuyUpload(buffer, filename);
  else if (apiType === 'zann') link = await ZannUpload(buffer, filename);
  else link = await CatboxUpload(buffer, filename);

  if (!link || !/^https?:\/\//i.test(link)) throw new Error('Gagal upload');
  return link;
}
