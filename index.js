import 'dotenv/config';

import express from 'express';
import path from 'path';
import nodemailer from 'nodemailer';
import config from './config.js';
import { tiktokDownloaderVideo } from './scraper/tiktok.js';
import { submitTwitterUrl } from './scraper/x.js';
import { handleUpload } from './scraper/uploader.js';
import Instagram from './scraper/instagram.js';

// === Polyfill untuk __dirname di ESM ===
// Kita perlu ini karena __dirname tidak ada di ES Modules
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ======================================

const app = express();
const PORT = 3000;

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

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});