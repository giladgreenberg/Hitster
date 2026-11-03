// יוצר את כל אייקוני ה-PWA מתוך SVG אחד (דורש Playwright מותקן גלובלית)
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

function svg({ rounded, scale }) {
  const lines = Array.from({ length: 9 }, (_, i) => `<line x1="0" x2="512" y1="${70 + i * 52}" y2="${70 + i * 52}" stroke="#052647" stroke-opacity="0.07" stroke-width="3"/>`).join('')
  const g = `translate(256 256) scale(${scale}) translate(-256 -256)`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs><clipPath id="c"><rect width="512" height="512" rx="${rounded ? 112 : 0}"/></clipPath></defs>
  <g clip-path="url(#c)">
    <rect width="512" height="512" fill="#FAE9A6"/>
    ${lines}
    <line x1="${rounded ? 430 : 452}" x2="${rounded ? 430 : 452}" y1="0" y2="512" stroke="#D05A5A" stroke-opacity="0.55" stroke-width="6"/>
    <g transform="${g}">
      <rect x="120" y="96" width="272" height="320" rx="36" fill="#FFFDF8" stroke="#052647" stroke-opacity="0.12" stroke-width="4"/>
      <path d="M318 150H196l78 106-78 106h122" fill="none" stroke="#008692" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="120" y="380" width="272" height="10" fill="#052647" fill-opacity="0.0"/>
    </g>
  </g>
</svg>`
}

const anySvg = svg({ rounded: true, scale: 1 })
const fullSvg = svg({ rounded: false, scale: 1 })
const maskSvg = svg({ rounded: false, scale: 0.78 })
writeFileSync('public/favicon.svg', anySvg)

const browser = await chromium.launch()
const page = await browser.newPage()
async function shot(markup, size, file, transparent) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`)
  await page.screenshot({ path: 'public/' + file, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } })
}
for (const s of [48, 72, 96, 128, 144, 152, 192, 384, 512]) await shot(anySvg, s, `icon-${s}.png`, true)
await shot(maskSvg, 192, 'icon-maskable-192.png', false)
await shot(maskSvg, 512, 'icon-maskable-512.png', false)
await shot(fullSvg, 180, 'apple-touch-icon.png', false)
await shot(anySvg, 32, 'favicon-32.png', true)
await browser.close()
console.log('icons done')
