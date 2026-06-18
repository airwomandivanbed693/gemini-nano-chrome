const statusEl = document.getElementById("status");
const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const progressWrap = document.getElementById("progressWrap");
const progressFill = document.getElementById("progressFill");
const progressLabel = document.getElementById("progressLabel");

let session = null;
let starting = false;

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = kind || "";
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderInline(text) {
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, "$1<em>$2</em>");
  text = text.replace(/`(.+?)`/g, "<code>$1</code>");
  return text;
}

function renderMarkdown(raw) {
  const blocks = escapeHtml(raw).split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks
    .map((block) => {
      const lines = block.split("\n").filter((l) => l.trim().length);
      if (lines.length && lines.every((l) => /^[*-]\s+/.test(l.trim()))) {
        const items = lines
          .map((l) => "<li>" + renderInline(l.trim().replace(/^[*-]\s+/, "")) + "</li>")
          .join("");
        return "<ul>" + items + "</ul>";
      }
      return "<p>" + renderInline(block).replace(/\n/g, "<br>") + "</p>";
    })
    .join("");
}

function addBubble(role, text) {
  const row = document.createElement("div");
  row.className = "bubble-row" + (role === "user" ? " user" : "");
  const bubble = document.createElement("div");
  bubble.className = "bubble " + role;
  bubble.textContent = text;
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}

function addNote(text, isError) {
  addBubble(isError ? "error" : "system-note", text);
}

// Without the dev flags, create() requires an active user gesture the first
// time a device hasn't downloaded the model yet. A popup losing focus tears
// the whole document down, so session creation happens lazily on the first
// real click of Send rather than eagerly on load, which would either fail
// outside a gesture or race the popup being closed mid-download.
async function checkAvailability() {
  if (typeof LanguageModel === "undefined") {
    setStatus("API not found", "error");
    addNote("LanguageModel isn't available in this Chrome version. Update Chrome and try again.", true);
    return;
  }

  const availability = await LanguageModel.availability();
  if (availability === "unavailable") {
    setStatus("unavailable", "error");
    addNote("This device doesn't meet Gemini Nano's hardware requirements.", true);
    return;
  }

  if (availability === "available") {
    setStatus("ready", "ready");
  } else {
    setStatus("ready", "ready");
    addNote("First message downloads the model (~4GB). Keep this popup open until it finishes.");
  }
  inputEl.disabled = false;
  sendBtn.disabled = false;
  inputEl.focus();
}

async function ensureSession() {
  if (session) return session;
  starting = true;
  progressWrap.style.display = "block";
  try {
    session = await LanguageModel.create({
      monitor(m) {
        m.addEventListener("downloadprogress", (e) => {
          const pct = Math.round(e.loaded * 100);
          progressFill.style.width = pct + "%";
          progressLabel.textContent = `Downloading model: ${pct}%`;
        });
      },
    });
    progressWrap.style.display = "none";
    return session;
  } finally {
    starting = false;
  }
}

async function send() {
  const text = inputEl.value.trim();
  if (!text || starting) return;

  addBubble("user", text);
  inputEl.value = "";
  inputEl.style.height = "auto";
  sendBtn.disabled = true;
  inputEl.disabled = true;
  setStatus("thinking...", "busy");

  try {
    await ensureSession();
  } catch (err) {
    setStatus("error", "error");
    addNote("Could not start a session: " + err.message, true);
    sendBtn.disabled = false;
    inputEl.disabled = false;
    return;
  }

  const assistantBubble = addBubble("assistant", "");
  let raw = "";
  try {
    const stream = session.promptStreaming(text);
    for await (const chunk of stream) {
      raw += chunk;
      assistantBubble.innerHTML = renderMarkdown(raw);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  } catch (err) {
    assistantBubble.classList.add("error");
    assistantBubble.textContent = "Error: " + err.message;
  } finally {
    setStatus("ready", "ready");
    sendBtn.disabled = false;
    inputEl.disabled = false;
    inputEl.focus();
  }
}

sendBtn.addEventListener("click", send);
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + "px";
});

clearBtn.addEventListener("click", () => {
  if (starting) return;
  if (session) { session.destroy(); session = null; }
  messagesEl.innerHTML = "";
  checkAvailability();
});

checkAvailability();
