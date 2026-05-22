# Development Log

This file records completed feature and fix milestones. Keep entries short and update it whenever an agent completes or fixes something.

## 2026-05-22

- UI: synced renderer with 5-ban global BP rules, updated Ban slot/progress counts to 5 per side, normalized 元流之子 local hero records into rule-engine BP units while preserving local icons, and prefixed 元流之子 rule-engine errors with a clear Chinese UI message.
- Verification: `npm run typecheck`; `npm test`; `npm run build`; browser smoke test confirmed 5 Ban slots per side, `Ban 0/5` progress text, five 元流之子 role-variant cards, no horizontal overflow at 1280px, and 元流之子 illegal pick message from the rule engine.
- UI: fixed layout to prevent page-level scrolling (`overflow: hidden` on `.app-shell`, `flex: 1` on `.draft-board`) and forced equal heights for side panels and control column (`align-items: stretch`, internal `overflow: auto`).
- Verification: `npm run typecheck`; `npm run test`; `npm run build`.
- Rule engine: aligned 元流之子 validation with corrected rules: Ban remains role-variant-specific, current-game Pick blocks all 元流之子 variants for both sides, same-team prior global use blocks all later 元流之子 variants, and Peak Duel does not apply these global BP restrictions.
- Rules: corrected 元流之子 BP modeling. Ban remains role-variant-specific, but Pick any 元流之子 variant blocks all remaining 元流之子 variants for both sides in the current game; the using team also cannot pick any 元流之子 variant again in later games 1-6.
- Rules: updated KPL BO7 documentation from 4 bans to 5 bans per side, added `ban 2 -> pick 3 -> ban 3 -> pick 2` BP structure, and documented 元流之子 role-variant BP handling.
- Rule engine: updated normal BP to 5 bans per side, implemented the 17-step `ban 2 -> pick 3 -> ban 3 -> pick 2` sequence, and added 元流之子 role-variant ban/pick/global-use validation.
- Planning: created KPL BO7 global BP and Peak Duel rule documentation.
- Planning: selected Electron + React + TypeScript + Vite for cross-platform desktop app development.
- Planning: defined hero data approach using official `herolist.json`, generated CDN icon URLs, and local icon cache.
- Multi-agent workflow: defined agent ownership, prompts, development order, and handoff rules.
- Bootstrap: initialized Electron, React, TypeScript, Vite, npm scripts, and electron-builder configuration.
- Rule engine: implemented BO7 match state, global BP sequence, legal ban/pick checks, score advancement, side-selection handoff, match completion, and Peak Duel validation.
- Hero data: added `npm run sync:heroes`, generated `public/data/heroes.json`, and cached hero icons in `public/heroes/`.
- UI: implemented Chinese KPL-style BP simulator with setup, normal BP, winner selection, Peak Duel submission/reveal, result display, and local hero icons.
- Persistence: implemented autosave/open/save/export through Electron preload APIs and versioned match JSON validation.
- Packaging: added macOS packaging scripts and Windows packaging workflow at `.github/workflows/package-windows.yml`.
- QA: added rule-engine and match-persistence tests.
- UI: fixed non-fullscreen layout clipping by removing fixed page width assumptions, adding responsive single-column breakpoints, blended scrollbars, and lower Electron minimum window size.
- Verification: `npm run test`; `npm run build`; headless Chrome responsive smoke test at 900x650 and 420x640 confirmed no horizontal document overflow.
- UI: prioritized the active global BP hero selector in the center column and removed fixed-height column clipping so non-fullscreen windows use page scrolling instead of hiding the picker below BP details.
- Verification: `npm run test`; `npm run build`; active-BP headless Chrome smoke test at 1800x1030, 900x650, and 420x640 confirmed the hero selector appears as the first center-column control with no horizontal document overflow.
- Packaging: added signed macOS packaging commands, enabled hardened runtime signing configuration, and documented Developer ID/notarization prerequisites.
- Verification: `npm run typecheck`; `npm run test`; `npm run package:mac:signed` currently fails because this machine has no valid `Developer ID Application` code signing identity.
- Packaging: replaced default Electron icon with 亚瑟 hero icon (`build/icon.icns` for macOS, `build/icon.ico` for Windows), generated from cached hero asset `public/heroes/166.jpg`.
- Verification: `npm run package:mac` confirmed no "default Electron icon is used" warning.
- Packaging: added Electron hardened runtime entitlements for JIT, unsigned executable memory, and library validation to prevent signed Apple Silicon builds from crashing during V8 startup.
- Verification: `plutil -lint build/entitlements.mac.plist build/entitlements.mac.inherit.plist`; `npm run typecheck`; `npm run test`; `npm run build`; `npm run package:mac`; `codesign --verify --deep --strict --verbose=4 release/mac-arm64/KPL BP Panel.app`.
- Packaging: completed macOS Developer ID signing with entitlements, notarization, and stapling. Added `scripts/release-mac.sh` for one-command full release pipeline.
- Verification: `xcrun notarytool info a4f47a07` returned Accepted; `xcrun stapler staple` succeeded; `codesign --verify --deep --strict` passed; `spctl --assess` confirmed notarized.
- GitHub: added repository README and prepared the project for first GitHub source upload; release artifacts remain excluded from git and should be uploaded as GitHub Release assets after producing a valid signed/notarized macOS package.
- Verification: `gh --version`; `gh auth status` reports no authenticated GitHub session yet.

Verification currently available:

- `npm run test`
- `npm run typecheck`
- `npm run build`
- `npm run package:mac`

Known follow-up:

- Run Windows package smoke testing from the Windows CI artifact or a Windows machine.
