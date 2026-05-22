# Testing and Packaging

## 1. Test Strategy

Prioritize rule-engine tests over UI tests in the MVP.

Recommended layers:

- Unit tests for pure BP rule functions.
- Component tests for key UI interactions.
- Manual smoke tests for packaged desktop apps.

## 2. Rule Test Scenarios

Required tests:

- Games 1-6 block picking a hero banned in the current game.
- Games 1-6 provide 5 ban slots per side.
- Games 1-6 block both sides from picking the same hero in the same game.
- Games 1-6 block a team from reusing its own previous picks.
- Games 1-6 allow a team to pick a hero previously used by the opponent.
- Bans do not enter a team's global used hero pool.
- 元流之子 role variants can be banned independently.
- After either side picks any 元流之子 role variant in a game, both sides are blocked from picking any other 元流之子 role variant in that game.
- After a team uses any 元流之子 role variant in games 1-6, that team is blocked from picking any 元流之子 role variant in later global BP games.
- One team's previous 元流之子 usage does not block the opponent from picking 元流之子 in a later game.
- Completing a game updates score.
- Previous-game loser receives next-game side-selection right.
- Match ends when a team reaches 4 wins.
- Game 7 is only created after score reaches 3:3.
- Peak Duel ignores previous used hero pools.
- Peak Duel allows both teams to select the same hero.
- Peak Duel blocks duplicate heroes inside the same team lineup.

## 3. UI Test Scenarios

Required checks:

- New match setup creates a valid 0:0 BO7.
- Current BP step is visually obvious.
- Illegal selections are rejected with Chinese messages.
- Ban/Pick slots update without layout shift.
- Used hero pools update after each completed game.
- Peak Duel hides opponent submission before reveal.
- Result page shows every game's bans, picks, and winner.

## 4. Persistence Tests

Required checks:

- Autosave restores an in-progress match after restart.
- Manual save writes valid JSON.
- Open restores saved match state exactly.
- Exported JSON includes schema version and all games.
- Corrupt JSON is rejected with a clear Chinese error.
- Unsupported future schema version is rejected safely.

## 5. Development Commands

Current scripts:

```text
npm run dev
npm run test
npm run test:watch
npm run typecheck
npm run sync:heroes
npm run build
npm run package
npm run package:mac
npm run package:mac:signed
npm run package:mac:release
npm run package:win
npm run dist
```

Do not add commands that rewrite source files unless they are clearly named and documented.

Current packaging scripts:

- `npm run package:mac`: builds renderer/main/preload, then runs `electron-builder --mac dir`.
- `npm run package:mac:signed`: builds a macOS `.app` and `.dmg` with code signing required.
- `npm run package:mac:release`: builds a signed macOS `.app` and `.dmg` with notarization enabled.
- `npm run package:win`: builds renderer/main/preload, then runs `electron-builder --win nsis`.
- `npm run dist`: builds the full configured electron-builder target set.

macOS signed and notarized builds are available through `npm run package:mac:signed` and the release script at `scripts/release-mac.sh`.

## 6. macOS Packaging

Use electron-builder to produce:

- `.app`
- optional `.dmg`

Initial MVP packaging can be unsigned. For sharing outside local testing, use the signed or release macOS package command.

Before release outside local testing, install a valid Apple Developer ID Application certificate and configure notarization credentials.

Required local signing prerequisites:

- A valid `Developer ID Application` certificate available to `security find-identity -v -p codesigning`.
- The certificate's private key available in the active keychain.
- Electron hardened runtime entitlements are configured in `build/entitlements.mac.plist` and `build/entitlements.mac.inherit.plist`.
- For notarization, credentials stored once via `xcrun notarytool store-credentials` (see release script).

Local macOS packaging path:

```text
npm run package:mac
```

Signed macOS packaging path:

```text
npm run package:mac:signed
```

Notarized release packaging path:

```text
npm run package:mac:release
```

One-command release (build + sign + notarize + staple + verify):

```text
bash scripts/release-mac.sh
```

This script runs the full pipeline and produces a notarized `.app` ready for distribution.

Expected local output:

- `release/mac-arm64/KPL BP Panel.app` on Apple Silicon.
- `release/mac/KPL BP Panel.app` or the matching architecture folder on Intel/universal macOS builds.
- `release/KPL-BP-Panel-<version>-mac-<arch>.dmg` for signed/release DMG builds.

Before rebuilding a signed package after changing files, remove stale release output or let electron-builder replace it from a clean state. Do not edit `.app` contents after signing; any post-signing modification can invalidate the code signature.

Useful verification commands:

```text
codesign --verify --deep --strict --verbose=4 "release/mac-arm64/KPL BP Panel.app"
codesign -d --entitlements :- "release/mac-arm64/KPL BP Panel.app"
spctl -a -vvv -t exec "release/mac-arm64/KPL BP Panel.app"
```

Configured distributable artifact names use:

```text
KPL-BP-Panel-${version}-${os}-${arch}.${ext}
```

## 7. Windows Packaging

Preferred path:

- Build Windows `.exe` on GitHub Actions Windows runner or a Windows machine.

Avoid relying on macOS cross-build for Windows as the primary path, because NSIS, Wine, signing, and platform-specific behavior can create unstable builds.

Expected output:

- Windows installer `.exe`
- optional unpacked app artifact for smoke testing

Windows packaging path:

```text
npm ci
npm run package:win
```

The preferred CI path is `.github/workflows/package-windows.yml`, which runs on `windows-latest` and uploads:

- `release/KPL-BP-Panel-<version>-win-x64-setup.exe`
- `release/win-unpacked/`

The Windows installer artifact name is configured as:

```text
KPL-BP-Panel-${version}-${os}-${arch}-setup.${ext}
```

Use the GitHub Actions artifact for Windows smoke testing instead of treating a macOS cross-build as the primary release path.

## 8. Manual Release Checklist

Before sharing a build:

- App launches from packaged artifact.
- New match works.
- One complete BO7 can be simulated.
- Save/open/export works.
- Hero icons load from local bundled assets.
- No dev server dependency remains.
- App name and icon are set.
- Default Electron icon has been replaced before any public/shared release.
- Artifact names include app name, version, OS, architecture, and installer suffix where applicable.
- MVP build is unsigned unless signing has been explicitly requested.
- App does not claim official Tencent/KPL affiliation.
