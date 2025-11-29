import axios from "axios";
import * as cheerio from "cheerio";

class TutwuriBypassClient {
    constructor(opts = {}) {
        this.cookies = [];
        this.refererLocation = "";
        this.bypassEndpoint =
            opts.bypassEndpoint || "https://tursite.vercel.app/bypass";
        this.defaultSitekey = opts.sitekey || "0x4AAAAAAAfjzEk6sEUVcFw1";
    }

    atob(s) {
        if (typeof Buffer !== "undefined")
            return Buffer.from(s, "base64").toString("binary");
        return global.atob(s);
    }

    btoa(s) {
        if (typeof Buffer !== "undefined")
            return Buffer.from(s, "binary").toString("base64");
        return global.btoa(s);
    }

    async get(shortlink, sitekey) {
        this.shortlinkOrigin = new URL(shortlink).origin + "/";
        await this.step1_getInitialPage(shortlink);
        await this.step2_redirectWithParams();
        const sk = sitekey || this.defaultSitekey;
        await this.step4_bypassTurnstile(this.shortlinkOrigin, sk);
        await this.step5_verify();
        return await this.step7_go();
    }

    async step1_getInitialPage(shortlink) {
        const res = await axios.get(shortlink, {
            headers: this.defaultHeaders(new URL(shortlink).host)
        });
        this.appendCookies(res.headers["set-cookie"]);
        const $ = cheerio.load(res.data);
        this.rayId = $('input[name="ray_id"]').val();
        this.alias = $('input[name="alias"]').val();
    }

    async step2_redirectWithParams() {
        const res = await axios.get("https://tutwuri.id/redirect.php", {
            params: { ray_id: this.rayId, alias: this.alias },
            headers: {
                ...this.defaultHeaders("tutwuri.id"),
                cookie: this.getCookieHeader(),
                referer: this.shortlinkOrigin
            },
            maxRedirects: 0,
            validateStatus: null
        });
        this.appendCookies(res.headers["set-cookie"]);
        this.refererLocation = res.headers["location"];
    }

    async step4_bypassTurnstile(targetUrl, sitekey) {
        if (!targetUrl) throw new Error("targetUrl diperlukan untuk bypass.");
        if (!sitekey) throw new Error("sitekey diperlukan untuk bypass.");
        const res = await axios.get(this.bypassEndpoint, {
            params: {
                url: targetUrl,
                sitekey: sitekey
            },
            headers: {
                accept: "application/json"
            }
        });
        if (!res.data) throw new Error("Respons dari bypass endpoint kosong.");
        if (res.data.status !== "ok" || !res.data.token) {
            const msg =
                res.data?.message ||
                `Bypass gagal: ${JSON.stringify(res.data)}`;
            throw new Error(msg);
        }
        this.bypassResult = { token: res.data.token };
    }

    async step5_verify() {
        const res = await axios.post(
            "https://tutwuri.id/api/v1/verify",
            {
                _a: 0,
                "cf-turnstile-response": this.bypassResult.token
            },
            {
                headers: {
                    ...this.apiHeaders(),
                    origin: "https://tutwuri.id",
                    referer: `https://tutwuri.id/${this.refererLocation}`
                }
            }
        );
        this.verification = res.data;
    }

    async step7_go() {
        const res = await axios.post(
            "https.tutwuri.id/api/v1/go",
            {
                key: Math.floor(Math.random() * 1000),
                size: "2278.3408",
                _dvc: this.btoa(String(Math.floor(Math.random() * 1000)))
            },
            {
                headers: {
                    ...this.apiHeaders(),
                    origin: "https://tutwuri.id",
                    referer: `https://tutwuri.id/${this.refererLocation}`
                }
            }
        );
        const responseData = res.data;
        let decoded = null;
        try {
            decoded = this.decodeUParam(responseData?.url);
        } catch (err) {
            const fallback = this.tryFallbackDecode(responseData);
            if (fallback) {
                decoded = fallback;
            } else {
                throw new Error(
                    `Parameter "u" tidak ditemukan atau tidak bisa didecode. Response API: ${JSON.stringify(
                        responseData
                    )}`
                );
            }
        }
        return {
            ...responseData,
            linkGo: decoded
        };
    }

    tryFallbackDecode(resData) {
        if (!resData || typeof resData !== "object") return null;
        const candidateKeys = [
            "url",
            "redirect",
            "link",
            "target",
            "go",
            "data"
        ];
        for (const k of candidateKeys) {
            const v = resData[k];
            if (!v) continue;
            try {
                const attempt = this.decodeUParam(v);
                if (attempt) return attempt;
            } catch (e) {
                if (this.isProbablyUrl(v)) return v;
                const base64Try = this.tryDecodeBase64IfLooksLike(v);
                if (base64Try) return base64Try;
            }
        }
        if (resData?.u && typeof resData.u === "string") {
            try {
                const decodedU = this.atob(decodeURIComponent(resData.u));
                if (this.isProbablyUrl(decodedU)) return decodedU;
            } catch (e) {}
        }
        return null;
    }

    isProbablyUrl(s) {
        if (typeof s !== "string") return false;
        try {
            const u = new URL(s);
            return u.protocol === "http:" || u.protocol === "https:";
        } catch (e) {
            return false;
        }
    }

    tryDecodeBase64IfLooksLike(s) {
        if (typeof s !== "string") return null;
        const trimmed = s.replace(/\s+/g, "");
        const base64re = /^[A-Za-z0-9+/=]+$/;
        if (trimmed.length > 16 && base64re.test(trimmed)) {
            try {
                const dec = this.atob(trimmed);
                if (this.isProbablyUrl(dec)) return dec;
            } catch (e) {}
        }
        return null;
    }

    defaultHeaders(host) {
        return {
            authority: host,
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,/;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "accept-language": "ms-MY,ms;q=0.9,en-US;q=0.8,en;q=0.7",
            "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132"',
            "sec-ch-ua-mobile": "?1",
            "sec-ch-ua-platform": '"Android"',
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "none",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1",
            "user-agent":
                "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36"
        };
    }

    apiHeaders() {
        return {
            authority: "tutwuri.id",
            accept: "application/json, text/plain, /",
            "accept-language": "ms-MY,ms;q=0.9,en-US;q=0.8,en;q=0.7",
            cookie: this.getCookieHeader(),
            "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132"',
            "sec-ch-ua-mobile": "?1",
            "sec-ch-ua-platform": '"Android"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "user-agent":
                "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36"
        };
    }

    appendCookies(cookieArr) {
        if (!Array.isArray(cookieArr)) return;
        const parsed = cookieArr.map(c => c.split(";")[0]);
        this.cookies.push(...parsed);
    }

    getCookieHeader() {
        return decodeURIComponent(this.cookies.join("; "));
    }

    decodeUParam(fullUrl) {
        if (!fullUrl)
            throw new Error('Parameter "u" tidak ditemukan dalam URL.');
        if (typeof fullUrl !== "string")
            throw new Error("fullUrl bukan string.");
        try {
            const urlObj = new URL(fullUrl);
            const encodedU = urlObj.searchParams.get("u");
            if (encodedU) {
                try {
                    const decoded = this.atob(decodeURIComponent(encodedU));
                    if (this.isProbablyUrl(decoded)) return decoded;
                    return decoded;
                } catch (e) {
                    try {
                        const maybe = decodeURIComponent(encodedU);
                        return maybe;
                    } catch (ee) {}
                }
            } else {
                if (this.isProbablyUrl(fullUrl)) return fullUrl;
                const possibleU =
                    urlObj.searchParams.get("param") ||
                    urlObj.searchParams.get("data");
                if (possibleU) {
                    try {
                        const dec = this.atob(decodeURIComponent(possibleU));
                        if (this.isProbablyUrl(dec)) return dec;
                        return dec;
                    } catch (e) {}
                }
            }
        } catch (e) {
            if (this.isProbablyUrl(fullUrl)) return fullUrl;
            const base64Try = this.tryDecodeBase64IfLooksLike(fullUrl);
            if (base64Try) return base64Try;
            throw new Error(
                "Gagal parse URL atau decode. fullUrl: " + String(fullUrl)
            );
        }
        const base64Try2 = this.tryDecodeBase64IfLooksLike(fullUrl);
        if (base64Try2) return base64Try2;
        throw new Error('Parameter "u" tidak ditemukan dalam URL.');
    }
}

export default new TutwuriBypassClient();