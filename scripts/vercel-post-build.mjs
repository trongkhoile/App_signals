import { cp, mkdir, writeFile, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const funcDir = '.vercel/output/functions/__server.func'

await mkdir(funcDir, { recursive: true })
await mkdir('.vercel/output/static', { recursive: true })

// Copy server bundle — dist/server is where @lovable.dev/vite-tanstack-config puts it
if (!existsSync('dist/server')) {
  throw new Error('dist/server not found — did vite build succeed?')
}
await cp('dist/server', funcDir, { recursive: true, force: true })

// Copy static client files
if (existsSync('dist/client')) {
  await cp('dist/client', '.vercel/output/static', { recursive: true, force: true })
}

// Ensure Vercel routing config exists (Nitro vercel preset writes dist/config.json)
if (!existsSync('.vercel/output/config.json')) {
  if (existsSync('dist/config.json')) {
    await copyFile('dist/config.json', '.vercel/output/config.json')
    console.log('✓ Copied dist/config.json → .vercel/output/config.json')
  } else {
    // Fallback: write a minimal routing config that forwards everything to the function
    await writeFile('.vercel/output/config.json', JSON.stringify({
      version: 3,
      routes: [
        { headers: { 'cache-control': 'public, max-age=31536000, immutable' }, src: '/assets/(.*)' },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/__server' },
      ],
    }, null, 2))
    console.log('✓ Wrote fallback .vercel/output/config.json')
  }
}

// Nitro v3 exports { fetch(req, context) } (Web API style).
// Vercel's Nodejs launcher expects module.exports = (req, res) => {}.
// This CJS wrapper bridges the two.
const wrapper = `'use strict';
const { pathToFileURL } = require('url');
const path = require('path');

let _app;
async function getApp() {
  if (!_app) {
    const mod = await import(pathToFileURL(path.join(__dirname, 'index.mjs')).href);
    _app = mod.default;
  }
  return _app;
}

module.exports = async function handler(req, res) {
  const app = await getApp();
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = req.headers.host || 'localhost';
  const url = new URL(req.url || '/', proto + '://' + host);

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v != null) headers.set(k, Array.isArray(v) ? v.join(', ') : String(v));
  }

  const method = req.method || 'GET';
  const hasBody = !['GET', 'HEAD'].includes(method);
  let body = null;
  if (hasBody) {
    body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }

  const webReq = new Request(url.href, { method, headers, body });
  const webRes = await app.fetch(webReq, { waitUntil: () => {} });

  res.statusCode = webRes.status;
  for (const [k, v] of webRes.headers) res.setHeader(k, v);
  const buf = Buffer.from(await webRes.arrayBuffer());
  res.end(buf);
};
`

await writeFile(`${funcDir}/_handler.js`, wrapper)

await writeFile(`${funcDir}/.vc-config.json`, JSON.stringify({
  runtime: 'nodejs22.x',
  handler: '_handler.js',
  launcherType: 'Nodejs',
  shouldAddHelpers: false,
}, null, 2))

console.log('✓ .vercel/output/functions/__server.func ready')
console.log('✓ .vercel/output/static ready')
