import axios from 'axios';
import * as cheerio from "cheerio";
import qs from 'querystring'; 

export async function submitTwitterUrl(tweetUrl) {
  try {
    const initialResponse = await axios.get('https://tweeload.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const cookies = initialResponse.headers['set-cookie'];

    const response = await axios.post(
      'https://tweeload.com/download',
      qs.stringify({ url: tweetUrl }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookies.join('; '),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Referer': 'https://tweeload.com/',
          'Origin': 'https://tweeload.com'
        },
        maxRedirects: 0,
        validateStatus: status => status >= 200 && status < 400
      }
    );

    const $ = cheerio.load(response.data);
    const links = [];

    $('a[href*="download"]').each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        const fullUrl = href.startsWith('http') ? href : `https://tweeload.com${href}`;
        if (!fullUrl.includes('chrome.google.com')) {
          links.push(fullUrl);
        }
      }
    });

    $('video source').each((i, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('chrome.google.com')) {
        links.push(src);
      }
    });

    return [
      {
        url: tweetUrl,
        links
      }
    ];
  } catch (error) {
    return [
      {
        url: tweetUrl,
        links: [],
        error: error.message,
        status: error.response?.status || null
      }
    ];
  }
}