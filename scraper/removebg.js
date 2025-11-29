import axios from "axios";
import FormData from "form-data";
import fetch from "node-fetch"; // Diperlukan untuk Pixelcut

/**
 * Menghapus background menggunakan API Pixelcut.
 * @param {Buffer} buffer - Buffer gambar (JPG/PNG).
 * @returns {Promise<string>} - URL gambar hasil (PNG).
 */
export async function removeBgPixelcut(buffer) {
  const form = new FormData();
  form.append('image', buffer, { filename: 'image.png', contentType: 'image/png' });
  form.append('format', 'png');

  try {
    // Pixelcut menggunakan 'fetch' di contoh aslinya
    const res = await fetch('https://api2.pixelcut.app/image/matte/v1', {
      method: 'POST',
      headers: { 
        'x-client-version': 'web',
        // Headers 'Content-Type' akan diatur otomatis oleh node-fetch + FormData
      },
      body: form
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Pixelcut API Error: ${res.status} ${errorText}`);
    }

    // API ini mengembalikan blob, bukan JSON.
    // Kita perlu mengubahnya menjadi Data URL (base64) agar bisa ditampilkan di ejs
    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const bufferBase64 = Buffer.from(arrayBuffer).toString('base64');
    
    // Kembalikan sebagai Data URL
    return `data:${blob.type};base64,${bufferBase64}`;

  } catch (error) {
    console.error("Error di removeBgPixelcut:", error.message);
    throw new Error("Gagal memproses gambar di Pixelcut.");
  }
}

/**
 * Menghapus background menggunakan API RemoveBG.one.
 * @param {Buffer} buffer - Buffer gambar (JPG/PNG).
 * @returns {Promise<string>} - URL gambar hasil (PNG).
 */
export async function removeBgOne(buffer) {
  const form = new FormData();
  form.append("file", buffer, "image.png");

  try {
    let { data } = await axios.post("https://removebg.one/api/predict/v2", form, {
      headers: {
        ...form.getHeaders(),
        "accept": "application/json, text/plain, */*",
        "locale": "en-US",
        "platform": "PC",
        "product": "REMOVEBG",
        "sec-ch-ua": "\"Chromium\";v=\"127\", \"Not)A;Brand\";v=\"99\", \"Microsoft Edge Simulate\";v=\"127\", \"Lemur\";v=\"127\"",
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": "\"Android\"",
        "Referer": "https://removebg.one/upload"
      }
    });

    // Berdasarkan kode Anda, URL ada di data.data.cutoutUrl
    if (data && data.data && data.data.cutoutUrl) {
      return data.data.cutoutUrl;
    } else {
      throw new Error("Respon API RemoveBG.one tidak valid.");
    }

  } catch (error) {
    console.error("Error di removeBgOne:", error.message);
    throw new Error("Gagal memproses gambar di RemoveBG.one.");
  }
}