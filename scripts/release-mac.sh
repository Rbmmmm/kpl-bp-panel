#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== 1/4 Build & Sign ==="
npm run package:mac:signed

APP="release/mac-arm64/KPL BP Panel.app"
ZIP="release/mac-arm64/KPL-BP-Panel-notarize.zip"

echo "=== 2/4 Submit for Notarization ==="
rm -f "$ZIP"
ditto -c -k --keepParent "$APP" "$ZIP"
xcrun notarytool submit "$ZIP" --keychain-profile "kpl-bp-panel" --wait --timeout 15m

echo "=== 3/4 Staple Ticket ==="
xcrun stapler staple "$APP"

echo "=== 4/4 Verify ==="
codesign --verify --deep --strict --verbose=1 "$APP"
spctl --assess --verbose=1 "$APP" 2>&1 || true

echo ""
echo "Done: $APP"
echo "Notarized and ready for distribution."
