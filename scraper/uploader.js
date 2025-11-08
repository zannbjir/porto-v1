import fetch from 'node-fetch';
import FormData from 'form-data';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname untuk ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Simpan folder 'uploads' di folder root proyek, bukan di dalam 'scraper'
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
// === Tambah di paling atas (setelah import) ===
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


// --- API 1: Catbox (Lama) ---
async function CatboxUpload(filePath) {
  const form = new FormData();
  form.append("fileToUpload", fs.createReadStream(filePath));
  form.append("reqtype", "fileupload");

  const res = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
  });

  return await res.text();
}

// --- API 2: Tmpfiles (Baru, dari kode Python) ---
async function TmpfilesUpload(filePath) {
  const form = new FormData();
  
  // Data dari skrip Python:
  form.append("max_minutes", 60);
  form.append("max_views", 0);
  
  // File dari skrip Python:
  form.append("input_file", fs.createReadStream(filePath));

  const res = await fetch("https://tmpfiles.org/?upload", {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
    // Skrip Python menggunakan 'allow_redirects=False'
    // di node-fetch, ini adalah 'redirect: manual'
    redirect: 'manual' 
  });

  // Skrip Python membaca header 'location' dari redirect
  if (res.status === 302 || res.status === 303) {
      const location = res.headers.get('location');
      if (location) {
          // Skrip Python juga mengganti '/download/' menjadi '/dl/'
          const upload_path = location.replace('/download/', '/dl/');
          return "https://tmpfiles.org" + upload_path;
      }
  }

  // Jika bukan redirect, berarti error
  const textBody = await res.text();
  throw new Error(`tmpfiles.org upload gagal. Status: ${res.status}. Body: ${textBody}`);
}


// --- API 3: Uguu (Baru) ---
async function UguuUpload(filePath) {
  const form = new FormData();
  form.append('files[]', fs.createReadStream(filePath)); // sesuai API Uguu

  const res = await fetch('https://uguu.se/upload', {
    method: 'POST',
    body: form,
    headers: form.getHeaders(),
  });

  // Uguu default respon JSON
  const contentType = res.headers.get('content-type') || '';
  const raw = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const bodyText = typeof raw === 'string' ? raw : JSON.stringify(raw);
    throw new Error(`uguu.se upload gagal. Status: ${res.status}. Body: ${bodyText}`);
  }

  // Bentuk JSON Uguu biasanya: [{ name, url, ... }]
  // Kadang beberapa implementasi membungkus di { files: [...] }
  let filesArr = [];
  if (Array.isArray(raw)) filesArr = raw;
  else if (raw && Array.isArray(raw.files)) filesArr = raw.files;

  if (filesArr.length && filesArr[0].url) return filesArr[0].url;

  // Fallback: jika output berupa teks url tunggal
  if (typeof raw === 'string' && raw.startsWith('http')) return raw.trim();

  throw new Error(`Respon Uguu tidak dikenal: ${typeof raw === 'string' ? raw : JSON.stringify(raw)}`);
}

// --- API: Cihuy (pakai public key, tanpa token) ---
async function CihuyUpload(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath)); 
  form.append('key', '220109');              

  // pastikan TIDAK ada Authorization
  const headers = { ...form.getHeaders() };
  delete headers.authorization;
  delete headers.Authorization;

  const res = await fetch(`https://cihuy.biz.id/api/upload`, {
    method: 'POST',
    body: form,
    headers,
  });

  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    throw new Error(`cihuy upload gagal: ${res.status} ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }

  const urlPath = body?.url;
  if (!urlPath) throw new Error(`Respon Cihuy tidak berisi url: ${JSON.stringify(body)}`);
  return urlPath.startsWith('http') ? urlPath : `https://cihuy.biz.id${urlPath}`;
}



async function ZannUpload(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath)); // field harus "file"

  const res = await fetch("https://zann.web.id/upload", {
    method: "POST",
    body: form,
    headers: form.getHeaders(),
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    throw new Error(`Zann upload gagal. Status: ${res.status}. Body: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }

  // Support beberapa format JSON umum
  const url =
    data?.url ||
    data?.data?.url ||
    (typeof data === 'string' && data.startsWith('http') ? data : null);

  if (!url) {
    throw new Error(`Respon Zann tidak berisi url: ${JSON.stringify(data)}`);
  }

  return url;
}


// --- Handler Utama (Di-update) ---
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
  const filepath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  fs.writeFileSync(filepath, buffer);

  try {
    let link;

    if (apiType === 'tmpfiles') {
  link = await TmpfilesUpload(filepath);
} else if (apiType === 'uguu') {
  link = await UguuUpload(filepath);
} else if (apiType === 'cihuy') {
  link = await CihuyUpload(filepath);
} else if (apiType === 'zann') {
  link = await ZannUpload(filepath);
} else {
  link = await CatboxUpload(filepath);
}

    if (!link || !/^https?:\/\//i.test(link)) throw new Error('Gagal upload');

    return link;
  } finally {
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  }
}
