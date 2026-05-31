# Chrome Web Store — Listing & Review Notes

Reference material for submitting **Easy English Rewriter** to the Chrome Web Store.
Copy the relevant sections into the Developer Dashboard fields, and host the Privacy Policy
at a public URL.

---

## Single purpose

> Easy English Rewriter rewrites English text that the user selects on a web page into
> simpler, easier-to-read English, entirely on-device using Chrome's built-in AI.

The extension has one clear purpose: simplifying selected English text. All secondary
features (read-aloud, translation of the result) act only on text the user has explicitly
selected and converted.

---

## Permissions justification

Paste these into the "Permission justification" fields during submission.

### `storage`
> Stores the user's preferences only: the difficulty level (A2/B1/B2) and the optional
> translation target language. No browsing data or page content is stored. Settings sync
> via the user's own Chrome profile.

### `contextMenus`
> Adds a single right-click menu item, "Rewrite in simpler English", shown only when text
> is selected, so the user can trigger a conversion on the selected text.

### Host access — content script on `<all_urls>`
> The extension lets users simplify English text on any website they choose to read, so the
> content script must be available on all pages. It activates only on a user action
> (selecting text and clicking the floating button, or using the right-click menu). It reads
> only the text the user has selected at that moment. It does not read, collect, monitor, or
> transmit page content in the background, and it sends nothing to any external server — all
> processing happens locally via Chrome's built-in AI.

### Permissions intentionally NOT requested
- **No `scripting`** — the content script is injected declaratively via `content_scripts`.
- **No `activeTab`** — not needed; declarative injection covers all usage.
- **No `tabs`, no host_permissions for fetch, no `<all_urls>` host_permissions block** —
  the extension never makes cross-origin network requests.

---

## Data usage disclosures (Dashboard checkboxes)

- **Does this item collect user data?** → **No.**
- Personally identifiable info: **No**
- Health, financial, authentication, personal communications, location, web history,
  user activity, website content: **Not collected / not transmitted.**
- The selected text is sent only to Chrome's **on-device** built-in AI (Gemini Nano) and the
  on-device Translator API. It never leaves the user's device.
- **Remote code:** **No** — all code is bundled in the package; nothing is fetched or `eval`'d.
- Certify compliance with the Developer Program Policies: **Yes.**

---

## Privacy Policy

**Published at:** https://kimuson.github.io/Easy-English-Rewriter/ (use this URL in the
Dashboard's "Privacy policy URL" field). Terms of Service:
https://kimuson.github.io/Easy-English-Rewriter/terms.html

The text below is the source of that page (also in `docs/index.html`):

> **Easy English Rewriter — Privacy Policy**
> _Last updated: 2026-05-31_
>
> **Summary: we do not collect, store, or transmit your data.**
>
> **What the extension does.** When you select English text on a page and choose to simplify
> it (via the floating button or the right-click menu), the selected text is processed by
> Chrome's built-in on-device AI (Gemini Nano) to produce a simpler version. Optional
> features can read the result aloud (using your browser/OS speech engine) or translate it
> using Chrome's built-in on-device Translator API.
>
> **Data we collect.** None. We do not collect, log, sell, or share any personal information,
> browsing history, or page content.
>
> **Where your text goes.** The text you select is processed entirely on your own device. It
> is not sent to our servers or any third-party server. The extension makes no network
> requests of its own.
>
> **What is stored.** Only your preferences (difficulty level and translation target
> language) are stored locally via Chrome's settings storage, synced through your own Chrome
> account. These contain no personal data.
>
> **Third parties.** The extension relies on features built into Google Chrome (the built-in
> AI and Translator). Their behavior is governed by Google's own policies. We share nothing
> with any third party.
>
> **Contact.** <yuta.kimura@nexaspark.org>

> Contact email is set. Host this policy text at a public URL and link it in the listing.

---

## Suggested store description (English)

> **Read English more easily — anywhere on the web.**
>
> Easy English Rewriter turns hard-to-read English into simpler, clearer English. Just select
> any English text and click "Simplify". Great for learners and non-native readers.
>
> ✦ Select text → get a simpler version instantly
> ✦ Choose a difficulty level: Beginner (A2), Simple (B1), or Plain (B2)
> ✦ Listen to the result read aloud
> ✦ Optionally translate the result into your language
> ✦ 100% on-device — free, private, works offline. Your text never leaves your computer.
>
> **Requirements:** Chrome 138 or later with built-in AI support. On first use, Chrome
> downloads the on-device AI model (a one-time download of a few GB; requires sufficient disk
> space and supported hardware). After that, everything runs locally and offline.

---

## Pre-submission checklist

- [ ] Register a Chrome Web Store developer account ($5 one-time fee)
- [ ] Host the Privacy Policy (and Terms) text at a public URL and link it in the listing
- [ ] Prepare a 128×128 icon (current gradient icon works) and 1–5 screenshots (1280×800)
- [ ] Bump `version` in manifest.json for each release
- [ ] Zip the extension folder (exclude this STORE.md and README.md if desired) and upload
- [ ] Fill in permission justifications (above) and data-usage disclosures (all "No")
- [ ] State clearly in the description that Chrome 138+ and a one-time model download are required
