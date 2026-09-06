const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());

function isSafeUrl(url) {
    try {
        const u = new URL(url);
        return ['http:', 'https:'].includes(u.protocol) && !['localhost', '127.0.0.1'].includes(u.hostname);
    } catch(e) { return false; }
}

app.get('/', (req, res) => res.json({ status: 'CineSubz Sniper v15 Active' }));

app.get('/api/finaldl', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const targetUrl = req.query.url;
    if (!targetUrl || !isSafeUrl(targetUrl)) {
        return res.status(400).json({ success: false, error: 'Invalid or missing URL parameter' });
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-extensions',
                '--no-first-run',
                '--no-zygote',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();
        let rawUrls = [];

        // 🎯 [NETWORK SNIPER]: Back-end network requests වලින් සෘජුවම Download links Capture කිරීම
        page.on('request', request => {
            const reqUrl = request.url();
            if (reqUrl.includes('yadev511.xyz') || reqUrl.includes('pixeldrain.com') || reqUrl.includes('videoplayback') || /\.(mp4|mkv|m3u8)/i.test(reqUrl)) {
                rawUrls.push(reqUrl);
            }
        });

        // Image සහ Font විතරක් Block කර Script/Style Load වීමට ඉඩ හැරීම
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'font', 'media'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 720 });

        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} };
            window.alert = function() { return true; };

            window._multiCapturedUrls = [];
            window.open = function(url) {
                if (url && typeof url === 'string') {
                    window._multiCapturedUrls.push(url);
                }
                return { closed: false, close: () => {} };
            };
        });

        // Page එක Load වීමට 3s-4s තත්පර ලබා දීම
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 3000));

        // Click Simulation
        let allButtonCoordinates = [];
        try {
            allButtonCoordinates = await page.evaluate(() => {
                let coordsList = [];
                const selectors = [
                    '.button.direct-download', 
                    '.button[class*="download"]', 
                    'a[href*="yadev511"]', 
                    'a[href*="pixeldrain"]',
                    'a[href*="drive06.skylines822.online"]',
                    'a[href*="drive02.skylines822.online"]',
                    'button[class*="download"]', 
                    '.btn-success'
                ];
                
                let elements = [];
                selectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(el => {
                        if (!elements.includes(el) && el.offsetWidth > 0 && el.offsetHeight > 0) {
                            elements.push(el);
                        }
                    });
                });

                const allElements = document.querySelectorAll('a, button');
                for (let el of allElements) {
                    const text = (el.innerText || '').toLowerCase();
                    if ((text.includes('download') || text.includes('direct')) && !text.includes('telegram') && !elements.includes(el) && el.offsetWidth > 0) {
                        elements.push(el);
                    }
                }

                elements.forEach(btn => {
                    btn.removeAttribute('disabled');
                    btn.style.pointerEvents = 'auto';
                    btn.style.opacity = '1';
                    const rect = btn.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        coordsList.push({
                            x: rect.left + rect.width / 2,
                            y: rect.top + rect.height / 2
                        });
                    }
                });

                return coordsList;
            });
        } catch (e) {}

        for (let i = 0; i < Math.min(allButtonCoordinates.length, 3); i++) {
            const coord = allButtonCoordinates[i];
            try {
                await page.mouse.move(coord.x, coord.y);
                await page.mouse.down();
                await page.mouse.up();
            } catch (err) {}
            await new Promise(r => setTimeout(r, 1200));
        }

        const windowOpenUrls = await page.evaluate(() => window._multiCapturedUrls || []).catch(() => []);
        windowOpenUrls.forEach(u => rawUrls.push(u));

        const finalPageUrl = await page.url();
        rawUrls.push(finalPageUrl);

        // Deduplication Logic
        let uniqueUrlsMap = new Map();

        rawUrls.forEach(urlStr => {
            if (urlStr.includes('yadev511.xyz') || urlStr.includes('pixeldrain.com') || urlStr.includes('videoplayback') || /\.(mp4|mkv|m3u8)/i.test(urlStr)) {
                try {
                    const u = new URL(urlStr);
                    const cleanPath = u.origin + u.pathname; 
                    if (!uniqueUrlsMap.has(cleanPath)) {
                        uniqueUrlsMap.set(cleanPath, urlStr);
                    }
                } catch (e) {
                    if (!uniqueUrlsMap.has(urlStr)) uniqueUrlsMap.set(urlStr, urlStr);
                }
            }
        });

        const resultArray = Array.from(uniqueUrlsMap.values());
        await browser.close().catch(() => {});

        if (resultArray.length > 0) {
            return res.json({
                success: true,
                count: resultArray.length,
                download_urls: resultArray
            });
        } else {
            return res.json({ success: false, error: 'No unique download streams detected.' });
        }

    } catch(err) {
        if (browser) await browser.close().catch(() => {});
        return res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log('🚀 Sniper Active on port', PORT));
