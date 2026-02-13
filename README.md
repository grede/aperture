# 📸 Aperture

**AI-powered localized app store screenshot automation.**

Record one walkthrough → get store-ready screenshots in 30+ languages.

## The Problem

Indie developers and small teams manually capture screenshots for every language × every screen × every device size. It's a combinatorial nightmare that scales as `O(languages × screens × sizes)`.

## The Solution

Aperture lets you **record one walkthrough** on a local iOS Simulator, then **automatically replays** it for every locale. The AI agent handles test data, navigation, screenshots, design templates, and localized marketing copy — exporting store-ready assets.

**No XCUITest code required.** Unlike Fastlane snapshot (requires XCUITest scripts), Aperture uses an accessibility-tree-first approach with AI fallback — just click through your app once.

## How It Works

```
1. Record    →  Walk through your app once, mark screenshot points
2. Localize  →  AI generates culturally appropriate test data per locale
3. Replay    →  Automated playback across all configured languages
4. Export    →  Templated, store-ready PNGs in all required sizes
```

## Quick Start

```bash
# Initialize project
aperture init --app ./MyApp.app

# Record a walkthrough
aperture record

# Generate locale data for 5 languages
aperture locales generate --locales en,de,fr,ja,ko

# Run across all locales and export
aperture run my-recording --locales all
aperture export my-recording --style modern
```

## Features

- 🎬 **Record & Replay** — Deterministic playback via iOS accessibility tree selectors
- 🌍 **30+ Languages** — Automatic locale switching, AI-generated test data & marketing copy
- 🤖 **AI Fallback** — GPT-4o-mini resolves UI elements when selectors break
- 🎨 **5 Built-in Templates** — `minimal` · `modern` · `gradient` · `dark` · `playful`
- 📱 **Store-Ready Export** — App Store dimensions (6.7", 6.5", 5.5" + iPad), device frames, localized text overlays
- 🖥️ **Web Recorder** — Browser-based recording with live Simulator preview
- ⚡ **Cached Runs** — Successful AI resolutions are cached for instant reruns

## Architecture

```
CLI (Commander.js)
  ├── DeviceManager      — xcrun simctl + WebDriverAgent
  ├── Recorder           — Action capture + iOS accessibility tree
  ├── Player             — Deterministic replay + AI fallback
  ├── Parameterizer      — GPT-4o-mini text input analysis
  ├── LocaleManager      — Simulator locale switching via plist
  ├── TemplateEngine     — Sharp image compositing
  ├── TranslationService — Localized copy generation + cache
  └── WebServer          — Express + WebSocket for web UI
```

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Simulator Control:** Appium XCUITest driver + WebDriverAgent + `xcrun simctl`
- **Image Processing:** Sharp
- **AI:** OpenAI GPT-4o-mini (parameterization, translations, element fallback)
- **Web UI:** Express + WebSocket + Simulator mirroring
- **CLI:** Commander.js

## Roadmap

| Milestone | Scope | Timeline |
|-----------|-------|----------|
| **M1** | Core recording + playback (CLI, iOS Simulator) | 4 weeks |
| **M2** | AI parameterization + localization | 8 weeks |
| **M3** | Templates + export + web UI | 12 weeks |
| **v2** | Android support, cloud execution, CI/CD | Post-MVP |

## Docs

- [Product Requirements Document](docs/prd.md)

## License

MIT
