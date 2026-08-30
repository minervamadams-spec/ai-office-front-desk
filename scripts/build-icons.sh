#!/bin/bash
# Regenerates assets/icon.icns, assets/icon.ico, and assets/icon.png from assets/icon.svg.
# macOS only (uses iconutil + sips' rsvg-convert); the .icns/.ico/.png outputs are checked into git
# so this only needs to be re-run when the source SVG changes.
set -euo pipefail
cd "$(dirname "$0")/.."

command -v rsvg-convert >/dev/null || { echo "rsvg-convert not found — brew install librsvg" >&2; exit 1; }

rm -rf assets/icon.iconset
mkdir -p assets/icon.iconset
for size in 16 32 64 128 256 512 1024; do
  rsvg-convert -w "$size" -h "$size" assets/icon.svg -o "assets/icon.iconset/tmp_${size}.png"
done
cp assets/icon.iconset/tmp_16.png   assets/icon.iconset/icon_16x16.png
cp assets/icon.iconset/tmp_32.png   assets/icon.iconset/icon_16x16@2x.png
cp assets/icon.iconset/tmp_32.png   assets/icon.iconset/icon_32x32.png
cp assets/icon.iconset/tmp_64.png   assets/icon.iconset/icon_32x32@2x.png
cp assets/icon.iconset/tmp_128.png  assets/icon.iconset/icon_128x128.png
cp assets/icon.iconset/tmp_256.png  assets/icon.iconset/icon_128x128@2x.png
cp assets/icon.iconset/tmp_256.png  assets/icon.iconset/icon_256x256.png
cp assets/icon.iconset/tmp_512.png  assets/icon.iconset/icon_256x256@2x.png
cp assets/icon.iconset/tmp_512.png  assets/icon.iconset/icon_512x512.png
cp assets/icon.iconset/tmp_1024.png assets/icon.iconset/icon_512x512@2x.png
rm assets/icon.iconset/tmp_*.png

iconutil -c icns assets/icon.iconset -o assets/icon.icns
cp assets/icon.iconset/icon_512x512.png assets/icon.png
node scripts/build-ico.mjs

echo "Rebuilt assets/icon.icns, assets/icon.ico, assets/icon.png"
