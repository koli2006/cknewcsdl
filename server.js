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

app.get('/', (req, res) => res.json({ status: 'CineSubz Sniper v15 Intelligent De-Duplicator Online' }));

app.get('/bypass', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl || !isSafeUrl(targetUrl)) return res.status(400).json({ success: false, error: 'Invalid URL' });

    console.log('\n' + '='.repeat(60));
    console.log('🚀 [LAUNCH v15 SMART MULTI] TARGET:', targetUrl);
    console.log('='.repeat(60));

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-accelerated-2d-canvas',
                '--disable-software-rasterizer',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1440, height: 900 });

        let rawUrls = []; 

        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} };
            window.alart = function() { return true; };
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

        console.log('[1] Loading Target DOM smoothly...');
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        console.log('[2] Holding 4 seconds for script activation...');
        await new Promise(r => setTimeout(r, 4000));

        console.log('[3] Scanning for all Download Elements...');
        
        const allButtonCoordinates = await page.evaluate(() => {
            let coordsList = [];
            const selectors = [
                '.button.direct-download', 
                '.button[class*="download"]', 
                'a[href*="yadev511"]', 
                'a[href*="pixeldrain"]',
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
                coordsList.push({
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                });
            });

            return coordsList;
        });

        console.log(`🎯 Found ${allButtonCoordinates.length} potential download elements.`);

        for (let i = 0; i < allButtonCoordinates.length; i++) {
            const coord = allButtonCoordinates[i];
            console.log(`🖱️ Clicking Button [${i + 1}] at X: ${coord.x}, Y: ${coord.y}`);
            
            await page.mouse.move(coord.x, coord.y);
            await page.mouse.down();
            await page.mouse.up();
            
            await new Promise(r => setTimeout(r, 1500));
        }

        console.log('[4] Gathering and filtering harvested payload streams...');
        
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

        if (resultArray.length > 0) {
            console.log(`🏁 [SUCCESS v15] Filtered down to ${resultArray.length} Unique Links:`, resultArray);
            res.json({
                success: true,
                count: resultArray.length,
                download_urls: resultArray
            });
        } else {
            console.log('❌ [TIMEOUT] No unique download streams detected.');
            res.json({ success: false, error: 'No unique download streams detected from the elements.' });
        }

        await browser.close().catch(() => {});

    } catch(err) {
        console.error('💥 SYSTEM FATAL:', err.message);
        if (browser) await browser.close().catch(() => {});
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('🚀 Sniper v15 Active on port', PORT));
