import 'dotenv/config';

import cors from 'cors';
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

// === Polyfill untuk __dirname ===
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ===============================

const app = express();
const PORT = process.env.PORT || 3000;

// === KONFIGURASI ENV ===
const {
    GIST_ID, GITHUB_TOKEN, APP_DOMAIN, GITHUB_USER, CDN_REPO, REPO_PATH = ''
} = process.env;

const githubApi = axios.create({
    baseURL: 'https://api.github.com',
    headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
    },
});

function generateRandomCode(length = 6) {
    return Math.random().toString(36).substring(2, 2 + length);
}

function checkBase64Size(base64String, limitInMB = 5) {
    // Rumus estimasi: (length * 3/4) - padding
    // 5MB = 5 * 1024 * 1024 bytes
    if (!base64String) return false;
    
    // Hapus header data:image/...;base64, jika ada untuk hitungan akurat
    const base64Data = base64String.replace(/^data:.+;base64,/, '');
    const sizeInBytes = (base64Data.length * 3) / 4;
    const limitInBytes = limitInMB * 1024 * 1024;
    
    return sizeInBytes <= limitInBytes;
}

// === DATA API LENGKAP (Struktur Diperbarui untuk Docs Baru) ===
const apiData = {
    title: "Razan API's",
    description: "Dokumentasi REST API Portofolio Razan.is-a.dev",
    baseURL: APP_DOMAIN || "https://razan.is-a.dev",
    endpoints: [
        {
            route: "/api/tiktok",
            name: "TikTok Downloader",
            description: "Download video TikTok tanpa watermark",
            category: "Downloader",
            methods: ["POST"],
            paramsSchema: {
                url: { type: "string", required: true }
            }
        },
        {
            route: "/api/instagram",
            name: "IG Downloader",
            description: "Download konten Instagram (Reels/Image)",
            category: "Downloader",
            methods: ["POST"],
            paramsSchema: {
                url: { type: "string", required: true }
            }
        },
        {
            route: "/api/twitter",
            name: "X/Twitter Downloader",
            description: "Download video dari Twitter / X",
            category: "Downloader",
            methods: ["POST"],
            paramsSchema: {
                url: { type: "string", required: true }
            }
        },
        {
            route: "/api/skiplink",
            name: "Bypass Link",
            description: "Bypass link shortener (Tutwuri, dll)",
            category: "Tools",
            methods: ["POST"],
            paramsSchema: {
                url: { type: "string", required: true }
            }
        },
        {
            route: "/api/detdata",
            name: "Detail Data",
            description: "Cek detail data (Endpoint Test GET)",
            category: "Information",
            methods: ["GET"],
            paramsSchema: {
                text: { type: "string", required: false }
            }
        },
        {
            route: "/api/removebg",
            name: "Remove Background",
            description: "Hapus background (Max 5MB)",
            category: "Tools",
            methods: ["POST"],
            paramsSchema: {
                base64: { type: "file", required: true },
                select: { type: "select", options: ["pixelcut", "removebgone"], required: true }
            }
        },
        {
            route: "/api/upload",
            name: "Uploader",
            description: "Upload gambar (Max 5MB). Pilih 'ALL' untuk semua.",
            category: "Tools",
            methods: ["POST"],
            paramsSchema: {
                base64: { type: "file", required: true },
                select: { 
                    type: "select", 
                    options: [
                        "catbox", 
                        "zann",      
                        "cihuy", 
                        "iimglive", 
                        "quax", 
                        "tmpfiles", 
                        "uguu", 
                        "all"       
                    ],
                    required: true 
                }
            }
        },
    ]
};

// === MIDDLEWARE ===
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// Limit besar untuk upload/base64
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// === HALAMAN UTAMA ===
app.get('/', (req, res) => {
    const domain = `${req.protocol}://${req.get("host")}`;
    res.render('index', { pageTitle: `Portofolio - ${config.bio.name}`, ...config, domain });
});

// === ROUTE BARU: API LANDING PAGE ===
app.get('/api', (req, res) => {
    res.render('api', {
        title: "Razan API's",
        endpointCount: apiData.endpoints.length
    });
});

// === ROUTE BARU: API DOCS ===
app.get('/docs', (req, res) => {
    res.render('docs', {
        apiData: apiData // Data dikirim langsung ke EJS
    });
});

// === HALAMAN LAIN ===
app.get('/tools', (req, res) => res.render('tools', { title: 'Razan - Tools', ...config }));
app.get('/manga', (req, res) => res.render('manga', { title: 'Razan - Manga', ...config }));
app.get('/downloader', (req, res) => res.render('download', { title: 'Razan - Downloader', ...config }));
app.get('/uploader', (req, res) => res.render('uploader', { title: 'Razan - Uploader', ...config }));
app.get('/donasi', (req, res) => res.render('donasi', { title: 'Razan - Donasi', ...config }));
app.get('/removebg', (req, res) => res.render('removebg', { title: 'Razan - RemoveBg', ...config }));
app.get('/skiplink', (req, res) => res.render('skiplink', { title: 'Razan - Skip Link', ...config }));
app.get('/shortener', (req, res) => res.render('shortener', { title: 'Razan - Shortener', ...config }));
app.get('/decoder', (req, res) => res.render('decoder', { title: 'Razan - Decoder', ...config }));

// === ENDPOINTS LOGIC ===
app.get('/api/detdata', (req, res) => {
    const { text } = req.query;
    res.json({
        status: 200,
        creator: "Razan Muhammad Ikhsan",
        result: {
            message: "Berhasil mengambil data",
            input: text || "Tidak ada input text",
            time: new Date()
        }
    });
});
// === ENDPOINT API UTILITIES (POST) ===
app.post('/send-email', (req, res) => {
    const { name, email, message } = req.body;
    const mailOptions = {
        from: email,
        to: process.env.EMAIL_USER, 
        subject: `Pesan Portofolio Baru dari ${name}`,
        text: `Nama: ${name}\nEmail: ${email}\nPesan:\n${message}`,
        html: `
            <div style="font-family: Arial; color: #333;">
                <h2>Pesan Baru dari Portofolio</h2>
                <p><strong>Nama:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Pesan:</strong></p>
                <div style="background: #f9f9f9; padding: 10px;">${message}</div>
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

app.all('/api/tiktok', async (req, res) => {
    const url = req.query?.url || req.body?.url;
    if (!url) {
        return res.status(400).json({
            status: false,
            error: "URL parameter is required",
            code: 400
        });
    }
    try {
        const data = await tiktokDownloaderVideo(url);
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: false, message: 'Server Error' });
    }
});

app.all('/api/instagram', async (req, res) => {
    const url = req.query?.url || req.body?.url;
    if (!url) {
        return res.status(400).json({
            status: false,
            error: "URL parameter is required",
            code: 400
        });
    }
    try {
        const data = await Instagram(url);
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: false, message: 'Server Error' });
    }
});

app.all('/api/twitter', async (req, res) => {
    const url = req.query?.url || req.body?.url;
    if (!url) {
        return res.status(400).json({
            status: false,
            error: "URL parameter is required",
            code: 400
        });
    }
    try {
        const data = await submitTwitterUrl(url);
        if (data && data.length > 0) res.json(data[0]);
        else throw new Error('Data tidak ditemukan');
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: false, message: 'Server Error' });
    }
});

app.post('/api/get-ip', async (req, res) => {
    try {
        const response = await axios.get('https://api.ipify.org?format=json', { timeout: 3000 });
        res.json({ status: 200, ip: response.data.ip });
    } catch (error) {
        res.status(500).json({ status: 500, error: 'Gagal mengambil IP.' });
    }
});

app.post('/api/upload', async (req, res) => {
    const { base64, provider } = req.body;
    
    if (!base64) return res.status(400).json({ status: 400, error: 'Base64 image required' });

    // Cek Ukuran File
    if (!checkBase64Size(base64, 5)) {
        return res.status(400).json({ status: 400, error: "File terlalu besar. Maksimal 5MB." });
    }

    try {
        // Jika user pilih "ALL", kita coba kirim ke beberapa provider secara paralel
        if (provider === 'all') {
            const providers = ["catbox", "quax", "uguu", "iimglive", "cihuy", "zann", "tmpfiles"]; // List provider yg disupport scraper kamu

            // Jalankan semua promise sekaligus
            const results = await Promise.allSettled(
                providers.map(p => handleUpload(base64, p).then(link => ({ provider: p, status: 'success', link })))
            );

            // Filter hasil
            const success = results.filter(r => r.status === 'fulfilled').map(r => r.value);
            const failed = results.filter(r => r.status === 'rejected');

            return res.json({
                status: 200,
                owner: "Razan Muhammad Ikhsan",
                note: "Multi-upload result",
                results: success,
                failed_count: failed.length
            });
        } 
        
        // Jika pilih provider spesifik (single upload)
        else {
            const link = await handleUpload(base64, provider);
            res.json({
                status: 200,
                owner: "Razan Muhammad Ikhsan",
                provider: provider,
                link: link
            });
        }
    } catch (e) {
        res.status(500).json({ status: 500, error: e.message || "Upload failed" });
    }
});

app.post('/api/removebg', async (req, res) => {
    const { base64, api } = req.body;
    if (!base64 || !api) return res.status(400).json({ status: 400, error: 'Input tidak lengkap' });

    // Cek Ukuran File
    if (!checkBase64Size(base64, 5)) {
        return res.status(400).json({ status: 400, error: "File terlalu besar. Maksimal 5MB." });
    }

    try {
        const m = base64.match(/^data:([^;]+);base64,(.+)$/);
        if (!m) throw new Error('Format base64 invalid');
        const buffer = Buffer.from(m[2], 'base64');

        let imageUrl;
        if (api === 'pixelcut') imageUrl = await removeBgPixelcut(buffer);
        else if (api === 'removebgone') imageUrl = await removeBgOne(buffer);
        else throw new Error('Provider API tidak valid');

        res.status(200).json({ status: 200, imageUrl: imageUrl });
    } catch (err) {
        res.status(500).json({ status: 500, error: err.message });
    }
});

app.post('/api/skiplink', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ status: 400, error: 'URL kosong' });
    try {
        const result = await TutwuriBypass.get(url);
        if (result && result.linkGo) res.json({ status: 200, link: result.linkGo });
        else throw new Error('Gagal bypass link');
    } catch (e) {
        res.status(500).json({ status: 500, error: e.message });
    }
});

app.post('/api/shorten', async (req, res) => {
    const { longUrl, customCode } = req.body;
    if (!GIST_ID || !GITHUB_TOKEN || !APP_DOMAIN) return res.status(500).json({ error: 'Config missing' });
    if (!longUrl) return res.status(400).json({ error: 'URL required' });

    try {
        const { data: gist } = await githubApi.get(`/gists/${GIST_ID}`);
        const gistFile = Object.values(gist.files)[0];
        if (!gistFile) return res.status(500).json({ error: 'Gist not found' });

        let links = JSON.parse(gistFile.content || '{}');
        let shortCode = customCode;

        if (!shortCode) {
            do { shortCode = generateRandomCode(); } while (links[shortCode]);
        } else if (links[shortCode]) {
            return res.status(400).json({ error: 'Code taken' });
        }

        links[shortCode] = longUrl;
        await githubApi.patch(`/gists/${GIST_ID}`, {
            files: { [gistFile.filename]: { content: JSON.stringify(links, null, 2) } },
        });

        res.json({ status: 200, link: `${APP_DOMAIN}/${shortCode}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Shorten failed' });
    }
});

// ===========================================
// == CATCH-ALL ROUTE (HARUS PALING BAWAH) ==
// ===========================================
app.get('/:code', async (req, res) => {
    const { code } = req.params;

    // 1. Cek Gist
    if (GIST_ID && GITHUB_TOKEN) {
        try {
            const { data: gist } = await githubApi.get(`/gists/${GIST_ID}`);
            const gistFile = Object.values(gist.files)[0];
            const links = JSON.parse(gistFile.content || '{}');
            if (links[code]) return res.redirect(302, links[code]);
        } catch (error) {
            console.error('Gist Error:', error.message);
        }
    }

    // 2. Cek Repo CDN
    if (GITHUB_USER && CDN_REPO) {
        try {
            const rawUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${CDN_REPO}/main/${REPO_PATH}${code}`;
            const response = await axios({ method: 'get', url: rawUrl, responseType: 'stream' });
            res.setHeader('Content-Type', response.headers['content-type']);
            res.setHeader('Content-Length', response.headers['content-length']);
            response.data.pipe(res);
            return;
        } catch (error) {
            // Fail silently
        }
    }

    // 3. Not Found
    res.status(404).send('Not Found');
});

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});