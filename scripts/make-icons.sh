#!/bin/sh
# Rendert die SVG-Icons zu PNG (macOS-Bordmittel: qlmanage + sips).
set -e
cd "$(dirname "$0")/../public/icons"
TMP=$(mktemp -d)
qlmanage -t -s 1024 -o "$TMP" icon.svg >/dev/null 2>&1
qlmanage -t -s 1024 -o "$TMP" maskable.svg >/dev/null 2>&1
sips -z 512 512 "$TMP/icon.svg.png" --out icon-512.png >/dev/null
sips -z 192 192 "$TMP/icon.svg.png" --out icon-192.png >/dev/null
sips -z 180 180 "$TMP/icon.svg.png" --out apple-touch-icon.png >/dev/null
sips -z 512 512 "$TMP/maskable.svg.png" --out maskable-512.png >/dev/null
rm -rf "$TMP"
ls -la
