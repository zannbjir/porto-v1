require('dotenv').config();
const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const config = require('./config.js');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});