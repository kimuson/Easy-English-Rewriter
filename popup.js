// popup.js — the browser-action popup: shows AI availability and holds settings.
// All conversion happens on selected text in the page; the model downloads
// automatically on the first conversion (progress shows in the page popup).

const statusEl = document.getElementById("status");
const statusText = document.getElementById("status-text");
const setupNote = document.getElementById("setup-note");
const levelSel = document.getElementById("level");
const nativeSel = document.getElementById("native-lang");

const DEFAULTS = { level: "b1", nativeLang: "" };

function setStatus(kind, text) {
  statusEl.className = `status status--${kind}`;
  statusText.textContent = text;
}

// ---- Check whether the built-in AI is available ----
chrome.runtime.sendMessage({ type: "availability" }, (res) => {
  if (chrome.runtime.lastError || !res) {
    setStatus("error", "Could not read the status.");
    return;
  }
  switch (res.state) {
    case "available":
      setStatus("ready", "Built-in AI is ready.");
      break;
    case "downloadable":
      setStatus("download", "Ready to use — the AI model downloads on your first conversion.");
      break;
    case "downloading":
      setStatus("download", "The AI model is downloading…");
      break;
    case "no-api":
      setStatus("error", "Built-in AI is not available in this browser.");
      showSetupNote();
      break;
    case "unavailable":
      setStatus("error", "The built-in AI model is not available on this device.");
      showSetupNote();
      break;
    default:
      setStatus("error", `Unknown state: ${res.state}${res.error ? " / " + res.error : ""}`);
      showSetupNote();
  }
});

function showSetupNote() {
  setupNote.hidden = false;
  setupNote.innerHTML =
    "Requires Chrome 138 or later. Enable \"Prompt API for Gemini Nano\" in <code>chrome://flags</code>, " +
    "then restart Chrome and try again.";
}

// ---- Settings ----
chrome.storage.sync.get(DEFAULTS, (s) => {
  levelSel.value = s.level;
  nativeSel.value = s.nativeLang;
});

levelSel.addEventListener("change", () => chrome.storage.sync.set({ level: levelSel.value }));
nativeSel.addEventListener("change", () => chrome.storage.sync.set({ nativeLang: nativeSel.value }));
