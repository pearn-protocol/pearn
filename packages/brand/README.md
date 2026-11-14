# brand

Pearn logo and icons, shared by the apps. One set: the mark is drawn on its own gradient tile, so it works on light and dark backgrounds alike.

| File | Use |
|---|---|
| `favicon.ico` (16 + 32), `favicon-16x16.png`, `favicon-32x32.png` | Browser tab |
| `apple-touch-icon.png` (180) | iOS home screen |
| `android-chrome-192x192.png`, `android-chrome-512x512.png` | PWA, `site.webmanifest`, README and org avatar |
| `tokens.css` | The ASCII Studio design tokens (black, orange accent, JetBrains Mono, square corners), shared by the app and the landing |
| `social-preview.png` (1280×640) | GitHub repository social preview (Settings → Social preview) |
| `mark.txt` | The burst as ASCII glyphs, the landing's hero. Regenerate with `node packages/brand/scripts/ascii.mjs` after the logo changes |

Accent `#fe835a` (the tile's top edge). The sites themselves are dark only (`#050505`).

```html
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
```
