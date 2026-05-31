// content.js — page-side logic (selection-based only)
//  - Floating "Simplify" button on text selection -> result popup
//  - Result popup with Listen (TTS), Copy, Translate, and the original text
//  - Also triggered by the right-click context menu

(() => {
  if (window.__easyEnglishLoaded) return;
  window.__easyEnglishLoaded = true;

  const PREFIX = "ceeng";
  const DEFAULTS = { level: "b1", nativeLang: "" };
  let settings = { ...DEFAULTS };

  chrome.storage?.sync.get(DEFAULTS, (s) => {
    settings = { ...DEFAULTS, ...s };
  });
  chrome.storage?.onChanged.addListener((changes) => {
    for (const k in changes) settings[k] = changes[k].newValue;
  });

  // ---- Requests to the background service worker ----
  let contextInvalidated = false;
  const RELOAD_MSG = "Extension was updated — please reload this page.";

  // True until the extension is reloaded/updated, after which chrome.runtime.id
  // becomes undefined and any messaging throws "Extension context invalidated".
  function contextOk() {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch (_) { return false; }
  }
  function looksInvalidated(m) {
    return /Extension context invalidated|context invalidated|message port closed|receiving end does not exist/i.test(m || "");
  }

  function send(msg) {
    return new Promise((resolve, reject) => {
      if (!contextOk()) {
        contextInvalidated = true;
        return reject(new Error(RELOAD_MSG));
      }
      try {
        chrome.runtime.sendMessage(msg, (res) => {
          const err = chrome.runtime.lastError;
          if (err) {
            if (looksInvalidated(err.message)) {
              contextInvalidated = true;
              return reject(new Error(RELOAD_MSG));
            }
            return reject(new Error(err.message));
          }
          if (!res) return reject(new Error("No response received."));
          if (!res.ok) return reject(new Error(res.error || "Request failed."));
          resolve(res.result);
        });
      } catch (e) {
        if (looksInvalidated(e && e.message)) contextInvalidated = true;
        reject(new Error(contextInvalidated ? RELOAD_MSG : (e && e.message) || String(e)));
      }
    });
  }
  const requestConvert = (text) => send({ type: "convert", text, level: settings.level });
  const requestTranslate = (text, target) => send({ type: "translate", text, target });

  // Loosely check whether the text looks like English (skip mostly non-Latin text).
  function looksEnglish(text) {
    const t = (text || "").trim();
    if (t.length < 3) return false;
    const letters = (t.match(/[A-Za-z]/g) || []).length;
    const nonLatin = (t.match(/[^\x00-\x7F]/g) || []).length;
    return letters >= 3 && letters >= nonLatin;
  }

  // ---- Text-to-speech (free, on-device) ----
  // Voices load asynchronously; cache them and refresh on the voiceschanged event.
  let voicesCache = [];
  function loadVoices() {
    try { voicesCache = window.speechSynthesis ? speechSynthesis.getVoices() : []; } catch (_) {}
  }
  if (window.speechSynthesis) {
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }

  function pickEnglishVoice() {
    const vs = (voicesCache && voicesCache.length) ? voicesCache : (window.speechSynthesis ? speechSynthesis.getVoices() : []);
    if (!vs || !vs.length) return null;
    const preferred = [
      "Google US English", "Samantha", "Microsoft Aria Online (Natural) - English (United States)",
      "Microsoft Jenny Online (Natural) - English (United States)", "Microsoft Zira - English (United States)",
      "Microsoft Aria", "Microsoft Jenny", "Daniel", "Karen", "Alex",
    ];
    for (const name of preferred) {
      const v = vs.find((x) => x.name === name);
      if (v) return v;
    }
    return vs.find((x) => /^en[-_]us/i.test(x.lang)) ||
           vs.find((x) => /^en[-_]gb/i.test(x.lang)) ||
           vs.find((x) => /^en/i.test(x.lang)) || null;
  }

  function speak(text, btn) {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      if (synth.speaking && btn && btn.dataset.speaking === "1") {
        synth.cancel();
        return;
      }
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voice = pickEnglishVoice();
      if (voice) u.voice = voice;
      u.lang = (voice && voice.lang) || "en-US";
      u.rate = 1.0;
      u.pitch = 1.0;
      if (btn) {
        const original = btn.dataset.label || btn.textContent;
        btn.dataset.label = original;
        btn.dataset.speaking = "1";
        btn.textContent = original.replace(/^[^\s]+/, "■");
        u.onend = u.onerror = () => {
          btn.dataset.speaking = "0";
          btn.textContent = original;
        };
      }
      synth.speak(u);
    } catch (_) {}
  }

  // =========================================================
  // Floating button (on selection)
  // =========================================================
  let floatBtn = null;
  let lastSelectionText = "";

  function removeFloatBtn() {
    if (floatBtn) { floatBtn.remove(); floatBtn = null; }
  }

  function showFloatButton(rect, text) {
    removeFloatBtn();
    floatBtn = document.createElement("div");
    floatBtn.className = `${PREFIX}-float-btn`;
    floatBtn.textContent = "Simplify";
    floatBtn.style.top = `${window.scrollY + rect.bottom + 6}px`;
    floatBtn.style.left = `${window.scrollX + rect.left}px`;
    floatBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rectNow = rect;
      removeFloatBtn();
      runSelectionConvert(text, rectNow);
    });
    document.body.appendChild(floatBtn);
  }

  document.addEventListener("mouseup", (e) => {
    if (e.target && e.target.closest && e.target.closest(`.${PREFIX}-popup, .${PREFIX}-float-btn`)) return;
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (!text || !looksEnglish(text) || sel.rangeCount === 0) { removeFloatBtn(); return; }
      lastSelectionText = text;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect && (rect.width || rect.height)) showFloatButton(rect, text);
    }, 10);
  });

  document.addEventListener("mousedown", (e) => {
    if (floatBtn && !floatBtn.contains(e.target)) removeFloatBtn();
  });
  document.addEventListener("scroll", removeFloatBtn, true);

  // =========================================================
  // Result popup
  // =========================================================
  let popup = null;

  function closePopup() {
    if (popup) {
      popup.remove();
      popup = null;
      document.removeEventListener("mousedown", onDocClickForPopup, true);
    }
  }
  function onDocClickForPopup(e) {
    if (popup && !popup.contains(e.target)) closePopup();
  }

  function showPopup(rect, original) {
    closePopup();
    popup = document.createElement("div");
    popup.className = `${PREFIX}-popup`;

    const top = window.scrollY + rect.bottom + 10;
    let left = window.scrollX + rect.left;
    const maxLeft = window.scrollX + document.documentElement.clientWidth - 392;
    if (left > maxLeft) left = Math.max(window.scrollX + 8, maxLeft);
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;

    popup.innerHTML = `
      <div class="${PREFIX}-popup-head">
        <span class="${PREFIX}-popup-title">Simpler English</span>
        <button class="${PREFIX}-popup-close" aria-label="Close">×</button>
      </div>
      <div class="${PREFIX}-popup-body">
        <div class="${PREFIX}-loading"><span class="${PREFIX}-spinner"></span> Converting…</div>
      </div>
      <details class="${PREFIX}-orig">
        <summary>Show original</summary>
        <div class="${PREFIX}-orig-text"></div>
      </details>
    `;
    popup.querySelector(`.${PREFIX}-orig-text`).textContent = original;
    popup.querySelector(`.${PREFIX}-popup-close`).addEventListener("click", closePopup);
    document.body.appendChild(popup);
    setTimeout(() => document.addEventListener("mousedown", onDocClickForPopup, true), 0);
    return popup;
  }

  function makeBtn(label, cls, onClick) {
    const b = document.createElement("button");
    b.className = `${PREFIX}-act ${cls || ""}`.trim();
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  function setPopupResult(result) {
    if (!popup) return;
    const body = popup.querySelector(`.${PREFIX}-popup-body`);
    body.innerHTML = "";

    const div = document.createElement("div");
    div.className = `${PREFIX}-result-text`;
    div.textContent = result;
    body.appendChild(div);

    const actions = document.createElement("div");
    actions.className = `${PREFIX}-actions`;

    actions.appendChild(makeBtn("🔊 Listen", "", (e) => speak(result, e.currentTarget)));

    const copyBtn = makeBtn("📋 Copy", "", () => {
      navigator.clipboard.writeText(result).then(() => {
        copyBtn.textContent = "✓ Copied";
        setTimeout(() => (copyBtn.textContent = "📋 Copy"), 1500);
      });
    });
    actions.appendChild(copyBtn);

    if (settings.nativeLang && settings.nativeLang !== "en") {
      const trBtn = makeBtn("🌐 Translate", "", async () => {
        trBtn.disabled = true;
        trBtn.textContent = "Translating…";
        let box = body.querySelector(`.${PREFIX}-translation`);
        if (!box) {
          box = document.createElement("div");
          box.className = `${PREFIX}-translation`;
          body.appendChild(box);
        }
        try {
          box.classList.remove(`${PREFIX}-tr-err`);
          box.textContent = await requestTranslate(result, settings.nativeLang);
        } catch (err) {
          box.classList.add(`${PREFIX}-tr-err`);
          box.textContent = "⚠️ " + err.message;
        } finally {
          trBtn.textContent = "🌐 Translate";
          trBtn.disabled = false;
        }
      });
      actions.appendChild(trBtn);
    }

    body.appendChild(actions);
  }

  function setPopupError(msg) {
    if (!popup) return;
    const body = popup.querySelector(`.${PREFIX}-popup-body`);
    body.innerHTML = "";
    const div = document.createElement("div");
    div.className = `${PREFIX}-error-text`;
    div.textContent = "⚠️ " + msg;
    body.appendChild(div);
  }

  function setPopupProgress(pct) {
    if (!popup) return;
    const loading = popup.querySelector(`.${PREFIX}-loading`);
    if (loading) loading.innerHTML = `<span class="${PREFIX}-spinner"></span> Downloading AI model… ${pct}%`;
  }

  async function runSelectionConvert(text, rect) {
    showPopup(rect, text);
    try {
      const result = await requestConvert(text);
      setPopupResult(result);
    } catch (e) {
      setPopupError(e.message);
    }
  }

  // =========================================================
  // Message handling (from context menu / background)
  // =========================================================
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Only accept messages from this extension's own background/popup.
    if (sender.id !== chrome.runtime.id) return;
    if (!msg || !msg.type) return;

    if (msg.type === "downloadProgress") {
      setPopupProgress(msg.pct);
      return;
    }

    if (msg.type === "convertSelection") {
      const sel = window.getSelection();
      const text = (sel ? sel.toString().trim() : "") || lastSelectionText;
      if (!text) {
        sendResponse && sendResponse({ ok: false, error: "No text is selected." });
        return;
      }
      let rect;
      if (sel && sel.rangeCount) rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect || (!rect.width && !rect.height)) rect = { bottom: 100, left: 100, top: 80 };
      runSelectionConvert(text, rect);
      sendResponse && sendResponse({ ok: true });
      return;
    }
  });
})();
