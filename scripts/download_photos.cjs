const fs = require('fs');
const path = require('path');
const https = require('https');

// simple .env parser (avoid adding dependencies)
const envPath = path.resolve(__dirname, '..', '.env');
let envText = '';
try { envText = fs.readFileSync(envPath, 'utf8'); } catch (e) { envText = ''; }
const env = {};
envText.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) {
            let val = m[2];
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
            env[m[1]] = val;
      }
});

const SUPABASE_URL = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env');
      process.exit(1);
}

const outDir = path.resolve(__dirname, '..', 'downloaded_photos');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const fetchJson = (url) => new Promise((resolve, reject) => {
      const options = new URL(url);
      const req = https.request(options, {
            method: 'GET', headers: {
                  apikey: SUPABASE_KEY,
                  Authorization: `Bearer ${SUPABASE_KEY}`,
                  Accept: 'application/json'
            }
      }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                  try { resolve(JSON.parse(data)); } catch (err) { reject(err); }
            });
      });
      req.on('error', reject);
      req.end();
});

const download = (url, dest) => new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      const req = https.get(url, (res) => {
            if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
      });
      req.on('error', (err) => { fs.unlink(dest, () => reject(err)); });
});

const collectUrlsFromRecord = (rec) => {
      const urls = new Set();
      if (!rec) return urls;
      if (rec.image_url && typeof rec.image_url === 'string' && rec.image_url.trim()) urls.add(rec.image_url);
      if (rec.photos) {
            try {
                  const arr = Array.isArray(rec.photos) ? rec.photos : JSON.parse(rec.photos);
                  arr.forEach(p => { if (p && p.url) urls.add(p.url); });
            } catch (e) {
                  // ignore
            }
      }
      return urls;
};

(async () => {
      try {
            console.log('Fetching restaurants...');
            const rests = await fetchJson(`${SUPABASE_URL}/rest/v1/restaurants?select=id,image_url,photos`);
            console.log('Fetching dishes...');
            const dishes = await fetchJson(`${SUPABASE_URL}/rest/v1/dishes?select=id,image_url,photos`);

            if (!Array.isArray(rests)) {
                  console.error('Unexpected restaurants response:', rests);
                  return;
            }
            if (!Array.isArray(dishes)) {
                  console.error('Unexpected dishes response:', dishes);
                  return;
            }

            const urls = new Set();
            rests.forEach(r => collectUrlsFromRecord(r).forEach(u => urls.add(u)));
            dishes.forEach(d => collectUrlsFromRecord(d).forEach(u => urls.add(u)));

            console.log(`Found ${urls.size} unique image urls.`);
            let i = 0;
            for (const url of urls) {
                  try {
                        i += 1;
                        const parsed = new URL(url);
                        const name = path.basename(parsed.pathname) || `photo-${i}.jpg`;
                        const dest = path.join(outDir, `${i}-${name}`);
                        console.log(`Downloading ${url} -> ${dest}`);
                        await download(url, dest);
                  } catch (err) {
                        console.error('Failed to download', url, err.message || err);
                  }
            }

            console.log('Done. Check the downloaded_photos folder.');
      } catch (err) {
            console.error('Error fetching from Supabase:', err && err.message ? err.message : err);
      }
})();
