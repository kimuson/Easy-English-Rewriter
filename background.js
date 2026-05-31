// background.js — Uses Chrome's built-in AI to rewrite English into simpler English,
// define words, and translate. All inference runs here in the service worker;
// content scripts call it via messages.

const SYSTEM_PROMPT = `You rewrite English text into simpler, easier-to-understand English.

Rules:
- Keep the original meaning. Do not add, remove, or invent any information.
- KEEP the original tone and register (formal stays formal, neutral stays neutral). Do NOT make it more casual or chatty.
- Do NOT add greetings, filler, or friendly phrases like "Hey there!", "Sure!", or "Let's...".
- Replace difficult or rare words with common, everyday words.
- Break long, complex sentences into shorter, clearer ones.
- Keep it in English. Do NOT translate to other languages.
- Do NOT add explanations, labels, quotes, or notes.
- Output ONLY the rewritten English text.`;

// Difficulty presets. The level instruction is added to each request so it can
// change without rebuilding the session.
const LEVELS = {
  a2: "Target level: CEFR A2 (beginner). Use only the most common, basic words and very short sentences.",
  b1: "Target level: CEFR B1 (intermediate). Use simple everyday words and short, clear sentences.",
  b2: "Target level: CEFR B2 (upper-intermediate). Use clear, plain English; simplify hard words but keep a natural flow.",
};

let sessionPromise = null;
const translatorCache = {};

// ---- Keep the service worker (and the warmed AI session) alive ----
// In MV3 the service worker is torn down after ~30s of inactivity, which would
// destroy the in-memory AI session and force the model to reload from disk on the
// next request. Once a session is warmed, a periodic alarm keeps the worker awake
// so the model loads only once (on first use) instead of every time.
const KEEPALIVE_ALARM = "easy-english-keepalive";

function startKeepAlive() {
  try {
    // 0.5 min (30s) is the shortest period Chrome allows for a packed extension.
    chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.5 });
  } catch (_) {}
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== KEEPALIVE_ALARM) return;
  // Handling an event resets the idle timer; awaiting an async API call extends
  // the worker's life a little further so it stays warm between user requests.
  chrome.runtime.getPlatformInfo(() => {});
});

// Support both the current and legacy shapes of the built-in AI API.
function getLanguageModel() {
  if (typeof LanguageModel !== "undefined") return LanguageModel;
  if (typeof self !== "undefined" && self.LanguageModel) return self.LanguageModel;
  if (typeof self !== "undefined" && self.ai && self.ai.languageModel) return self.ai.languageModel; // legacy
  return null;
}

async function checkAvailability() {
  const LM = getLanguageModel();
  if (!LM) return { state: "no-api" };
  try {
    const fn = LM.availability || LM.capabilities;
    if (!fn) return { state: "available" };
    const a = await fn.call(LM);
    // Current API: a string 'available' | 'downloadable' | 'downloading' | 'unavailable'
    if (typeof a === "string") return { state: a };
    // Legacy API: { available: 'readily' | 'after-download' | 'no' }
    if (a && a.available) {
      const map = { readily: "available", "after-download": "downloadable", no: "unavailable" };
      return { state: map[a.available] || a.available };
    }
    return { state: "available" };
  } catch (e) {
    return { state: "error", error: String(e && e.message || e) };
  }
}

function buildCreateOptions(monitor) {
  return {
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {
        const pct = Math.round((e.loaded || 0) * 100);
        monitor && monitor(pct);
      });
    },
  };
}

async function getSession(monitor) {
  const LM = getLanguageModel();
  if (!LM) throw new Error("Built-in AI (Prompt API) is not available in this browser. Please use Chrome 138 or later and enable the built-in AI.");

  const { state } = await checkAvailability();
  if (state === "unavailable") {
    throw new Error("The built-in AI model is not available on this device (your hardware may not be supported).");
  }

  if (!sessionPromise) {
    sessionPromise = (async () => {
      const opts = buildCreateOptions(monitor);
      // Declaring expected input/output languages avoids the "untested language"
      // guard that otherwise makes prompt() reject on some pages. Fall back through
      // older option shapes if a given build rejects them.
      const lang = {
        expectedInputs: [{ type: "text", languages: ["en"] }],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
      };
      const attempts = [
        { ...opts, ...lang, initialPrompts: [{ role: "system", content: SYSTEM_PROMPT }] },
        { ...opts, initialPrompts: [{ role: "system", content: SYSTEM_PROMPT }] },
        { ...opts, systemPrompt: SYSTEM_PROMPT },
      ];
      let lastErr;
      for (const cfg of attempts) {
        try {
          const session = await LM.create(cfg);
          startKeepAlive(); // keep the worker alive so this session is reused
          return session;
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr;
    })().catch((err) => {
      sessionPromise = null; // allow rebuilding on the next attempt
      throw err;
    });
  }
  return sessionPromise;
}

// Run a one-off prompt on a fresh cloned session so requests stay independent.
async function runPrompt(promptText, monitor) {
  const base = await getSession(monitor);
  let session = base;
  let cloned = false;
  if (typeof base.clone === "function") {
    try {
      session = await base.clone();
      cloned = true;
    } catch (_) {
      session = base;
    }
  }
  try {
    return await session.prompt(promptText);
  } finally {
    if (cloned && typeof session.destroy === "function") {
      try { session.destroy(); } catch (_) {}
    }
  }
}

async function convert(text, level, monitor) {
  const clean = (text || "").trim();
  if (!clean) return "";
  const levelInstruction = LEVELS[level] || LEVELS.b1;
  const prompt = `${levelInstruction}\nRewrite the following English into simpler, easier English. Keep the same tone and meaning. Output only the rewritten text:\n\n${clean}`;
  const out = await runPrompt(prompt, monitor);
  return cleanupOutput(out);
}

// The model sometimes adds a preamble or quotes; trim those off.
function cleanupOutput(s) {
  let t = (s || "").trim();
  t = t.replace(/^["'`“”]+|["'`“”]+$/g, "").trim();
  t = t.replace(/^(Sure[!,.]?|Here(?:'s| is)[^:]*:|Okay[!,.]?|Of course[!,.]?)\s*/i, "").trim();
  return t;
}

// ---- Translation (Chrome built-in Translator API) ----
function getTranslatorApi() {
  if (typeof Translator !== "undefined") return Translator;
  if (typeof self !== "undefined" && self.Translator) return self.Translator;
  return null;
}

async function getTranslator(target) {
  const T = getTranslatorApi();
  if (!T) throw new Error("The built-in Translator API is not available in this browser.");
  const key = `en->${target}`;
  if (!translatorCache[key]) {
    translatorCache[key] = (async () => {
      if (T.availability) {
        const a = await T.availability({ sourceLanguage: "en", targetLanguage: target });
        if (a === "unavailable") throw new Error(`Translation to "${target}" is not available on this device.`);
      }
      return await T.create({ sourceLanguage: "en", targetLanguage: target });
    })().catch((err) => {
      delete translatorCache[key];
      throw err;
    });
  }
  return translatorCache[key];
}

async function translate(text, target) {
  const clean = (text || "").trim();
  if (!clean || !target) return "";
  const t = await getTranslator(target);
  return await t.translate(clean);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only accept messages from this extension's own contexts (content scripts / popup).
  if (sender.id !== chrome.runtime.id) return;
  if (!msg || !msg.type) return;
  const tabId = sender.tab && sender.tab.id;

  if (msg.type === "convert") {
    const monitor = (pct) => {
      if (tabId != null) chrome.tabs.sendMessage(tabId, { type: "downloadProgress", pct }).catch(() => {});
    };
    convert(msg.text, msg.level, monitor)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: String(err && err.message || err) }));
    return true; // async response
  }

  if (msg.type === "translate") {
    translate(msg.text, msg.target)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: String(err && err.message || err) }));
    return true;
  }

  if (msg.type === "availability") {
    checkAvailability().then((a) => sendResponse(a));
    return true;
  }
});

// Right-click context menu (for selected text)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "easy-english-selection",
    title: "Rewrite in simpler English",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "easy-english-selection" || !tab || tab.id == null) return;
  // The content script is injected declaratively on page load. If it is not present
  // (e.g. a tab opened before the extension was installed), this no-ops; the user
  // can reload the page. We intentionally avoid the "scripting" permission.
  chrome.tabs.sendMessage(tab.id, { type: "convertSelection" }).catch(() => {});
});
