import 'dotenv/config';

import express from 'express';
import path from 'path';
import nodemailer from 'nodemailer';
import axios from 'axios';
import config from './config.js';
import { tiktokDownloaderVideo } from './scraper/tiktok.js';
import { submitTwitterUrl } from './scraper/x.js';
import { handleUpload } from './scraper/uploader.js';
import { removeBgPixelcut, removeBgOne } from './scraper/removebg.js';
import TutwuriBypass from './scraper/skiplink.js';
import Instagram from './scraper/instagram.js';

// === Polyfill untuk __dirname di ESM ===
// Kita perlu ini karena __dirname tidak ada di ES Modules
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ======================================

const app = express();
const PORT = 3000;

// === KONFIGURASI BARU UNTUK SHORTENER ===
// Ambil dari file .env Anda
const {
    GIST_ID,          // ID dari Gist GitHub Anda
    GITHUB_TOKEN,     // Personal Access Token GitHub
    APP_DOMAIN,       // Domain utama aplikasi Anda (cth: http://localhost:3000)
    GITHUB_USER,      // (Opsional) Username GitHub Anda untuk CDN Fallback
    CDN_REPO,         // (Opsional) Nama repo Anda untuk CDN Fallback
    REPO_PATH = ''    // (Opsional) Path di dalam repo CDN (cth: 'files/')
} = process.env;

// Buat instance Axios untuk Gist API
const githubApi = axios.create({
    baseURL: 'https://api.github.com',
    headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
    },
});

// Fungsi helper untuk generate kode random
function generateRandomCode(length = 6) {
    return Math.random().toString(36).substring(2, 2 + length);
}
// ======================================

// Kode ini sekarang aman karena __dirname sudah kita definisikan di atas
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS 
    }
});

app.get('/', (req, res) => {
    res.render('index', {
        pageTitle: `Portofolio - ${config.bio.name}`,
        ...config
    });
});
app.get('/tools', (req, res) => {
    res.render('tools', { title: 'Razan - Tools', ...config });
});
app.get('/downloader', (req, res) => {
    res.render('download', { title: 'Razan - Downloader', ...config });
});
app.get('/uploader', (req, res) => {
    res.render('uploader', { title: 'Razan - Uploader', ...config });
});
app.get('/donasi', (req, res) => {
    res.render('donasi', { title: 'Razan - Donasi', ...config });
});
app.get('/removebg', (req, res) => {
    res.render('removebg', { title: 'Razan - Remove Background', ...config });
});
app.get('/skiplink', (req, res) => {
    res.render('skiplink', { title: 'Razan - Skip Link', ...config });
});
app.get('/shortener', (req, res) => {
    res.render('shortener', { title: 'Razan - URL Shortener', ...config });
});
app.get('/decoder', (req, res) => {
    res.render('decoder', { title: 'Razan - URL Decoder', ...config });
});
app.get('/kill-wifi', (req, res) => {
    res.render('wifi', { title: 'Razan - Kill Wi-Fi', ...config });
});

app.post('/send-email', (req, res) => {
    const { name, email, message } = req.body;
    const mailOptions = {
        from: email,
        to: process.env.EMAIL_USER, 
        subject: `Pesan Portofolio Baru dari ${name}`,
        text: `Kamu menerima pesan dari:
Nama: ${name}
Email: ${email}
Pesan:
${message}
        `,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h2 style="color: #4A4A4A;">Pesan Baru dari Portofolio Kamu</h2>
                <p>Kamu menerima pesan baru dari pengunjung website:</p>
                <hr style="border: 0; border-top: 1px solid #eee;">
                <p style="margin-bottom: 5px;"><strong>Nama:</strong></p>
                <p style="margin-top: 0; padding: 10px; background-color: #f9f9f9; border-radius: 5px;">${name}</p>
                
                <p style="margin-bottom: 5px;"><strong>Email:</strong></p>
                <p style="margin-top: 0; padding: 10px; background-color: #f9f9f9; border-radius: 5px;">${email}</p>
                
                <p style="margin-bottom: 5px;"><strong>Pesan:</strong></p>
                <div style="margin-top: 0; padding: 10px; background-color: #f9f9f9; border-radius: 5px; white-space: pre-wrap;">${message}</div>
                <hr style="border: 0; border-top: 1px solid #eee;">
                <p style="font-size: 0.9em; color: #888;">Email ini dikirim otomatis dari form kontak portofolio kamu.</p>
            </div>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
            res.send('Maaf, ada kesalahan. Coba lagi nanti.');
        } else {
            console.log('Email terkirim: ' + info.response);
            res.redirect('/#contact');
        }
    });
});

// == API INTERNAL ==
app.post('/api/tiktok-download', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ status: false, message: 'URL tidak boleh kosong' });
    }

    try {
        const data = await tiktokDownloaderVideo(url);
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: false, message: 'Terjadi kesalahan di server' });
    }
});
app.post('/api/instagram-download', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ status: false, message: 'URL tidak boleh kosong' });
    }

    try {
        const data = await Instagram(url);
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: false, message: 'Terjadi kesalahan di server' });
    }
});
app.post('/api/twitter-download', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ status: false, message: 'URL tidak boleh kosong' });
    }

    try {
        const data = await submitTwitterUrl(url);
        if (data && data.length > 0) {
            res.json(data[0]); 
        } else {
            throw new Error('Tidak ada data yang ditemukan');
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: false, message: 'Terjadi kesalahan di server' });
    }
});

app.post('/api/get-ip', async (req, res) => {
    try {
        // Kita gunakan API eksternal untuk cek IP publik
        const response = await axios.get('https://api.ipify.org?format=json', {
            timeout: 3000 // 3 detik timeout
        });
        res.json({ status: 200, ip: response.data.ip });
    } catch (error) {
        console.error('Gagal mengambil IP Publik:', error.message);
        res.status(500).json({ status: 500, error: 'Gagal mengambil IP publik.' });
    }
});

// Uploader Api
app.post('/api/upload', async (req, res) => {
    const { base64, api, originalName } = req.body;

    try {
        const link = await handleUpload(base64, api, { originalName });
        res.json({
            status: 200,
            owner: "Razan Muhammad Ikhsan",
            link: link
        });
    } catch (e) {
        res.status(500).json({ status: 500, error: e.message });
    }
});

app.post('/api/removebg', async (req, res) => {
  const { base64, api } = req.body;

  if (!base64 || !api) {
    return res.status(400).json({ status: 400, error: 'Input tidak lengkap.' });
  }

  try {
    let imageUrl;

    const m = base64.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) throw new Error('Format base64 tidak valid');
    const buffer = Buffer.from(m[2], 'base64');

    // Pilih scraper berdasarkan 'api' dari frontend
    if (api === 'pixelcut') {
      imageUrl = await removeBgPixelcut(buffer); 
    } else if (api === 'removebgone') {
      imageUrl = await removeBgOne(buffer); 
    } else {
      throw new Error('Provider API tidak valid.');
    }

    if (!imageUrl) {
      throw new Error('Gagal mendapatkan URL gambar dari API.');
    }

    res.status(200).json({ status: 200, imageUrl: imageUrl });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 500, error: err.message || 'Terjadi kesalahan server.' });
  }
});

app.post('/api/skiplink', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ status: 400, error: 'URL tidak boleh kosong' });
    }
    try {
        const result = await TutwuriBypass.get(url);
        
        if (result && result.linkGo) {
            res.json({ status: 200, link: result.linkGo });
        } else {
            throw new Error('Gagal mendapatkan link tujuan.');
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ status: 500, error: e.message || 'Terjadi kesalahan server.' });
    }
});
// == RUTE API BARU UNTUK SHORTENER ==
// 
app.post('/api/shorten', async (req, res) => {
    const { longUrl, customCode } = req.body;
    
    if (!GIST_ID || !GITHUB_TOKEN || !APP_DOMAIN) {
        return res.status(500).json({ error: 'Shortener service not configured on server.' });
    }
    if (!longUrl) return res.status(400).json({ error: 'URL is required.' });

    try {
        const { data: gist } = await githubApi.get(`/gists/${GIST_ID}`);
        const gistFile = Object.values(gist.files)[0];
        if (!gistFile) return res.status(500).json({ error: 'Gist file not found.' });

        let links = JSON.parse(gistFile.content || '{}');
        let shortCode = customCode;

        if (!shortCode) {
            do { shortCode = generateRandomCode(); } while (links[shortCode]);
        } else if (links[shortCode]) {
            return res.status(400).json({ error: 'Custom code already in use.' });
        }

        links[shortCode] = longUrl;

        await githubApi.patch(`/gists/${GIST_ID}`, {
            files: { [gistFile.filename]: { content: JSON.stringify(links, null, 2) } },
        });

        res.json({ status: 200, link: `${APP_DOMAIN}/${shortCode}` });
    } catch (error) {
        console.error('Shorten error:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to shorten URL.' });
    }
});


// ======================================
// == CATCH-ALL ROUTE (HARUS PALING AKHIR) ==
// ======================================
// Rute ini akan menangani short link DAN fallback CDN
app.get('/:code', async (req, res) => {
    const { code } = req.params;

    // 1. Coba cari di Gist (Short Link)
    if (GIST_ID && GITHUB_TOKEN) {
        try {
            const { data: gist } = await githubApi.get(`/gists/${GIST_ID}`);
            const gistFile = Object.values(gist.files)[0];
            const links = JSON.parse(gistFile.content || '{}');
            
            if (links[code]) {
                return res.redirect(302, links[code]);
            }
        } catch (error) {
            console.error('Error fetching Gist for redirect:', error.message);
            // Jangan kirim respons, lanjut ke fallback CDN
        }
    }

    // 2. Coba cari di Repo CDN (Fallback)
    if (GITHUB_USER && CDN_REPO) {
        try {
            const rawUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${CDN_REPO}/main/${REPO_PATH}${code}`;
            const response = await axios({ 
                method: 'get', 
                url: rawUrl, 
                responseType: 'stream' 
            });

            res.setHeader('Content-Type', response.headers['content-type']);
            res.setHeader('Content-Length', response.headers['content-length']);
            response.data.pipe(res);
            return; // Sukses streaming
        } catch (error) {
            // Gagal streaming, lanjut ke 404
            console.error('CDN fallback error:', error.message);
        }
    }

    // 3. Jika semua gagal, tampilkan 404
    res.status(404).send('Not Found'); // Atau render halaman 404.ejs jika ada
});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});