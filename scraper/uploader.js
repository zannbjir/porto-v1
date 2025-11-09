import fetch from 'node-fetch';
import FormData from 'form-data';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';

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

/**
 * Meng-upload file ke Cihuy API (versi Cloudinary).
 * @param {Buffer} buffer - Buffer file.
 * @param {string} filename - Nama file.
 * @returns {Promise<string>} - URL file dari Cihuy.
 */
async function CihuyUpload(buffer, filename) {
  const CIHUY_API_URL = 'https://cihuy.biz.id/api';
  // Saya asumsikan ini adalah KUNCI PUBLIK Anda
  // (process.env.PUBLIC_API_KEY di server Anda)
  const CIHUY_TOKEN = 'Bearer 220109'; 

  try {
    // === LANGKAH 1: Dapatkan Signature dari Cihuy ===
    const signRes = await fetch(`${CIHUY_API_URL}/sign-upload`, {
      method: 'GET',
      headers: { 'Authorization': CIHUY_TOKEN },
    });
    
    const signData = await signRes.json();
    if (!signRes.ok) {
      throw new Error(`Cihuy sign-upload gagal: ${signData.message || 'Gagal mendapatkan signature'}`);
    }
    const { timestamp, signature, cloudName, apiKey } = signData;

    // === LANGKAH 2: Upload File ke Cloudinary ===
    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
    const cloudForm = new FormData();
    
    cloudForm.append('file', buffer, filename);
    cloudForm.append('api_key', apiKey);
    cloudForm.append('timestamp', timestamp);
    cloudForm.append('signature', signature);

    const cloudRes = await fetch(cloudinaryUrl, {
      method: 'POST',
      body: cloudForm,
      headers: cloudForm.getHeaders(), // Penting untuk form-data
    });

    const cloudData = await cloudRes.json();
    if (!cloudRes.ok) {
      throw new Error(`Cloudinary upload gagal: ${cloudData.error?.message || 'Error tidak diketahui'}`);
    }

    // Ambil metadata yang dibutuhkan oleh Cihuy API
    const { public_id, original_filename, secure_url, resource_type, format, bytes } = cloudData;

    // === LANGKAH 3: Kirim Metadata kembali ke Cihuy API ===
    const metadataRes = await fetch(`${CIHUY_API_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': CIHUY_TOKEN,
        'Content-Type': 'application/json', // Sekarang pakai JSON
      },
      body: JSON.stringify({ // Kirim body sebagai JSON
        public_id,
        original_filename,
        secure_url,
        resource_type,
        format,
        bytes,
      }),
    });

    const metadataBody = await metadataRes.json();
    if (!metadataRes.ok) {
      throw new Error(`Cihuy metadata post gagal: ${metadataBody.message || 'Gagal menyimpan metadata'}`);
    }

    // === LANGKAH 4: Dapatkan URL Final ===
    const urlPath = metadataBody.url;
    if (!urlPath) {
      throw new Error(`Respon metadata Cihuy tidak berisi url: ${JSON.stringify(metadataBody)}`);
    }

    // Pastikan URL-nya lengkap
    return urlPath.startsWith('http') ? urlPath : `https://cihuy.biz.id${urlPath}`;

  } catch (error) {
    console.error('CihuyUpload Error:', error.message);
    throw new Error(`Cihuy upload gagal: ${error.message}`);
  }
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

async function TelegraphUpload(buffer, filename) {
  try {
    const typeInfo = await fileTypeFromBuffer(buffer);
    if (!typeInfo) {
      throw new Error('Tidak dapat mendeteksi tipe file dari buffer.');
    }
    
    const tempFilename = `tmp.${typeInfo.ext}`; 
    const form = new FormData();
    form.append('file', buffer, tempFilename);

    const res = await fetch('https://telegra.ph/upload', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    const ct = res.headers.get('content-type') || '';
    const body = ct.includes('application/json') ? await res.json() : await res.text();

    if (!res.ok) {
        const msg = typeof body === 'string' ? body : JSON.stringify(body);
        throw new Error(`Telegraph upload gagal: ${res.status} ${msg}`);
    }

    if (Array.isArray(body) && body[0]?.src) {
      return 'https://telegra.ph' + body[0].src;
    }
    
    if (body.error) {
        throw new Error(body.error);
    }
    
    throw new Error(`Respon Telegraph tidak dikenal: ${JSON.stringify(body)}`);

  } catch (error) {
    console.error('TelegraphUpload Error:', error.message);
    throw new Error(`Telegraph upload gagal: ${error.message}`);
  }
}

async function QuaxUpload(buffer, filename) {
  try {
    const typeInfo = await fileTypeFromBuffer(buffer);
    if (!typeInfo) {
      throw new Error('Tidak dapat mendeteksi tipe file dari buffer.');
    }
    const { ext, mime } = typeInfo;

    const form = new FormData();
    form.append('files[]', buffer, {
      filename: 'tmp.' + ext,
      contentType: mime,
    });
    // qu.ax mengharapkan 'expiry'
    form.append('expiry', '-1'); 

    const res = await fetch("https://qu.ax/upload.php", {
      method: 'POST',
      body: form,
      headers: {
        ...form.getHeaders(),
      }
    });

    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : await res.text();

    if (!res.ok) {
      const msg = data?.error || (typeof data === 'string' ? data : JSON.stringify(data));
      throw new Error(`Quax upload gagal: ${res.status} ${msg}`);
    }

    // Respon sukses: { status: 'success', files: [ { url: '...' } ] }
    if (data.files && data.files[0] && data.files[0].url) {
      return data.files[0].url;
    }

    throw new Error(`Respon Quax tidak dikenal: ${JSON.stringify(data)}`);

  } catch (error) {
    console.error('QuaxUpload Error:', error.message);
    throw new Error(`Quax upload gagal: ${error.message}`);
  }
}

async function IimgLiveUpload(buffer, filename) {
  try {
    const form = new FormData();
    // Snippet PHP mengonfirmasi field-nya adalah 'file'
    form.append('file', buffer, filename);

    const res = await fetch('https://iimg.live/upload.php', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    const ct = res.headers.get('content-type') || '';
    // Snippet PHP mengharapkan respons JSON
    const body = ct.includes('application/json') ? await res.json() : await res.text();

    if (!res.ok) {
      const msg = body?.error || (typeof body === 'string' ? body : JSON.stringify(body));
      throw new Error(`iImg.live upload gagal: ${res.status} ${msg}`);
    }

    // Snippet PHP memeriksa 'url'
    if (body.url) {
      return body.url;
    }

    throw new Error(`Respon iImg.live tidak berisi url: ${JSON.stringify(body)}`);

  } catch (error) {
    console.error('IimgLiveUpload Error:', error.message);
    throw new Error(`iImg.live upload gagal: ${error.message}`);
  }
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
  else if (apiType === 'telegraph') link = await TelegraphUpload(buffer, filename);
  else if (apiType === 'quax') link = await QuaxUpload(buffer, filename);
  else if (apiType === 'iimglive') link = await IimgLiveUpload(buffer, filename);
  else link = await CatboxUpload(buffer, filename); 

  if (!link || !/^https?:\/\//i.test(link)) throw new Error('Gagal upload');
  return link;
}