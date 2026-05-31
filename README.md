# Easy English Rewriter

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)
![Chrome 138+](https://img.shields.io/badge/Chrome-138%2B-success.svg)

A Chrome extension that rewrites English text on any web page into **simpler, easier-to-read
English** — while keeping the original tone and meaning. Built for English learners and
non-native readers.

It uses **Chrome's built-in AI (Gemini Nano / Prompt API)**, so it needs **no API key, is
free, and runs entirely on-device** (offline). Your text never leaves your computer.

> Everything works on **selected text**: highlight English on any page, and rewrite it.

---

## Features

- **Select to rewrite** — Drag-select English text and a **Simplify** button appears. Click it
  to see the simpler version in a popup. The original stays available under "Show original".
- **Right-click menu** — Select text, then right-click → **Rewrite in simpler English**.
- **Difficulty levels** — Choose **Beginner (A2)**, **Simple (B1)**, or **Plain (B2)** in the
  popup to control how simple the output is.
- **Listen (text-to-speech)** — Hear the result read aloud with the 🔊 button (uses your
  browser/OS speech engine).
- **Translate** — Optionally translate the result into your own language using Chrome's
  built-in **Translator API** (pick a target language in the popup).

---

## Requirements

- **Google Chrome 138 or later** with built-in AI (Prompt API) support
- Supported hardware capable of running the on-device model (Gemini Nano)
- Free disk space for the one-time model download (Chrome requires ~22 GB free; the model
  itself is a few GB)

On **first use**, Chrome downloads the on-device AI model automatically. Progress is shown
in the conversion popup. After that, everything runs locally and offline — no further
downloads.

If the built-in AI is disabled, enable these flags in `chrome://flags` and restart Chrome:

- `#prompt-api-for-gemini-nano` → **Enabled**
- `#optimization-guide-on-device-model` → **Enabled (BypassPerfRequirement)**

You can check the model status at `chrome://components` ("Optimization Guide On Device Model")
or `chrome://on-device-internals`.

---

## Install (developer mode)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder (`convert-easy-eng`)

After updating the code, click **Reload** on the extension card, then **reload any open tabs**
so they pick up the new content script.

---

## Usage

1. Open the toolbar popup to confirm the status (**"Built-in AI is ready"**) and set your
   **Difficulty** and optional **Translate to** language.
2. On any page, **select English text**.
3. Click the **Simplify** button that appears (or right-click → **Rewrite in simpler
   English**).
4. In the popup: read the simpler version, **🔊 Listen**, **📋 Copy**, **🌐 Translate**, or
   expand **Show original**.

---

## How it works

| File | Role |
|---|---|
| `manifest.json` | Extension definition (Manifest V3) |
| `background.js` | Service worker: calls the built-in AI (Prompt API) to rewrite text, and the Translator API to translate |
| `content.js` | Selection UI: floating button, result popup, TTS, copy, translate |
| `content.css` | Styles for the UI injected into pages (glass theme, light/dark) |
| `popup.html` / `popup.js` / `popup.css` | Toolbar popup: AI status and settings |
| `icons/` | Extension icons (16/48/128) |
| `STORE.md` | Chrome Web Store listing text, permission justifications, privacy policy |
| `LICENSE` | MIT license |

The rewriting behavior is controlled by `SYSTEM_PROMPT` and the `LEVELS` presets in
`background.js`.

### Architecture

```
Page (content.js)                 Service worker (background.js)        Chrome built-in AI
─────────────────                 ─────────────────────────────        ──────────────────
select text → Simplify  ──msg──▶  convert(text, level)          ──▶    Prompt API (Gemini Nano)
show result popup        ◀─────   rewritten text                ◀──
click 🌐 Translate       ──msg──▶  translate(text, target)       ──▶    Translator API
click 🔊 Listen          (local: Web Speech API, no messaging)
```

All AI runs on-device. The extension makes **no external network requests**.

---

## Privacy & permissions

- **No data collection. No external servers.** Selected text is processed only by Chrome's
  on-device AI; it never leaves the device.
- **Permissions:** `storage` (saves your difficulty/translation preferences) and
  `contextMenus` (the right-click item). The content script runs on all sites so you can
  simplify text anywhere, but it only acts on text you explicitly select.
- No `scripting`, `activeTab`, `tabs`, or remote code. See `STORE.md` for full justifications
  and the privacy policy.

---

## Configuration notes

- **Tone / behavior:** edit `SYSTEM_PROMPT` in `background.js`.
- **Difficulty presets:** edit the `LEVELS` map in `background.js`.
- **Translation languages:** edit the `<select id="native-lang">` options in `popup.html`.

---

## Limitations

- The built-in AI runs on-device, so output quality can be lower than cloud APIs, and speed
  depends on your hardware.
- Requires a one-time multi-GB model download and supported hardware; some users may not be
  able to run it.
- Works on English source text only.

---

## License

Released under the [MIT License](LICENSE). © 2026 Yuta Kimura, NEXASPARK.
