# KPL BP Panel

KPL BP Panel is a desktop simulator for KPL BO7 Ban/Pick workflows.

## Features

- Chinese KPL-style BO7 BP interface.
- Games 1-6 global BP flow with rule-engine validation.
- Game 7 Peak Duel blind lineup submission and reveal.
- Local hero data and icon cache.
- Autosave, open, save, and export through Electron.
- macOS and Windows packaging configuration.

## Development

```bash
npm ci
npm run dev
```

## Verification

```bash
npm run test
npm run typecheck
npm run build
```

## Packaging

macOS local package:

```bash
npm run package:mac
```

macOS signed package:

```bash
npm run package:mac:signed
```

macOS notarized release package:

```bash
npm run package:mac:release
```

Windows package:

```bash
npm run package:win
```

See [docs/testing-and-packaging.md](docs/testing-and-packaging.md) for signing, notarization, and release verification details.

## Asset Notes

Hero data and hero images are Tencent/Honor of Kings assets. This project uses them as local cached game reference data and does not imply official Tencent or KPL affiliation.
