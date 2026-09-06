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

app.get('/', (req, res) => res.json({ status: 'CineSubz Sniper v15 Ultra-Fast Online' }));

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
                '--disable-remote-fonts',
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-client-side-phishing-detection',
                '--disable-default-apps',
                '--disable-sync',
                '--metrics-recording-only',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 720 });

        let rawUrls = []; 

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
            console.log = function() {};
            console.clear = function() {};
        });

        // Safe Navigation with Networkidle2
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 2000));

        // Safely extract coordinates without context error
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
        } catch (e) {
            console.log('Navigation happened during evaluation, continuing...');
        }

        for (let i = 0; i < Math.min(allButtonCoordinates.length, 2); i++) {
            const coord = allButtonCoordinates[i];
            try {
                await page.mouse.move(coord.x, coord.y);
                await page.mouse.down();
                await page.mouse.up();
            } catch (err) {
                // Ignore mouse click failures if page navigated
            }
            await new Promise(r => setTimeout(r, 1000));
        }

        const windowOpenUrls = await page.evaluate(() => window._multiCapturedUrls || []).catch(() => []);
        windowOpenUrls.forEach(u => rawUrls.push(u));

        const finalPageUrl = await page.url();
        rawUrls.push(finalPageUrl);

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
app.listen(PORT, () => console.log('🚀 Fast Sniper v15 Active on port', PORT));
