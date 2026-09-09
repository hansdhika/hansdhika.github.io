const form = document.getElementById("form");
const errors = document.getElementById("errors");
const output = document.getElementById("output");
const statusEl = document.getElementById("status");
const commandSearch = document.getElementById("commandSearch");
const commandResults = document.getElementById("commandResults");
const selectedCommandEl = document.getElementById("selectedCommand");
const commandDescription = document.getElementById("commandDescription");
const remarkInput = document.getElementById("remark");
const scriptList = document.getElementById("scriptList");
const scriptCount = document.getElementById("scriptCount");

let commands = [];
let schema = null;
let scriptQueue = [];

async function init() {
  try {
    const response = await fetch("./commands/index.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Command index HTTP ${response.status}`);
    commands = await response.json();

    if (!Array.isArray(commands)) {
      throw new Error("commands/index.json must contain an array.");
    }

    renderCommandResults("");
    renderScriptQueue();
    statusEl.textContent = `${commands.length} command(s) loaded`;
  } catch (err) {
    statusEl.textContent = "Command index failed to load";
    commandResults.innerHTML = `
      <div class="command-empty">
        <strong>Unable to load commands.</strong><br>
        ${escapeHtml(err.message)}<br>
        <small>Check: commands/index.json</small>
      </div>`;
    commandResults.classList.add("show");
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[ch]));
}

function renderCommandResults(query = "") {
  const q = query.trim().toLowerCase();

  const matches = commands.filter(c => {
    const name = String(c.name || "").toLowerCase();
    const id = String(c.id || "").toLowerCase();
    return !q || name.includes(q) || id.includes(q);
  });

  if (!matches.length) {
    commandResults.innerHTML = `<div class="command-empty">No command found for <strong>${escapeHtml(query)}</strong>.</div>`;
    commandResults.classList.add("show");
    return;
  }

  commandResults.innerHTML = matches.map(c => `
    <button type="button" class="command-item" data-id="${escapeHtml(c.id)}">
      <strong>${escapeHtml(c.name)}</strong>
      <small>${escapeHtml(c.id)}</small>
    </button>
  `).join("");

  commandResults.classList.add("show");

  commandResults.querySelectorAll(".command-item").forEach(btn => {
    btn.addEventListener("mousedown", event => event.preventDefault());
    btn.addEventListener("click", () => selectCommand(btn.dataset.id));
  });
}

async function selectCommand(id) {
  const item = commands.find(c => String(c.id) === String(id));
  if (!item) return;

  try {
    const response = await fetch(`./commands/${encodeURIComponent(item.file)}`, {
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Command definition HTTP ${response.status}`);

    schema = await response.json();

    commandSearch.value = schema.name || item.name;
    selectedCommandEl.textContent = schema.name || item.name;
    commandDescription.textContent = schema.description || "";
    commandResults.classList.remove("show");

    errors.innerHTML = "";
    output.textContent = "Fill the parameters, then click Generate or + Add to Script.";
    remarkInput.value = "";
    renderForm();
    statusEl.textContent = "Command loaded";
  } catch (err) {
    statusEl.textContent = "Command definition failed to load";
    errors.innerHTML = `<div>• ${escapeHtml(err.message)}</div>`;
  }
}

function renderForm() {
  if (!schema) {
    form.innerHTML = "";
    return;
  }

  form.innerHTML = '<div class="grid">' + (schema.fields || []).map(f => {
    const requiredMark = f.required === false ? "" : " *";

    const control = f.type === "select"
      ? `<select id="${escapeHtml(f.id)}">
          <option value="" selected>- Please Select -</option>
          ${(f.options || []).map(x =>
            `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`
          ).join("")}
        </select>`
      : `<input id="${escapeHtml(f.id)}"
          type="${escapeHtml(f.type || "text")}"
          value=""
          ${f.min !== undefined ? `min="${f.min}"` : ""}
          ${f.max !== undefined ? `max="${f.max}"` : ""}
          placeholder="Please enter">`;

    return `<div class="field">
      <label for="${escapeHtml(f.id)}">${escapeHtml(f.label)}${requiredMark}</label>
      ${control}
      ${f.hint ? `<small>${escapeHtml(f.hint)}</small>` : ""}
    </div>`;
  }).join("") + '</div>';
}

function getValues() {
  const values = {};
  (schema.fields || []).forEach(f => {
    const el = document.getElementById(f.id);
    values[f.id] = el ? el.value.trim() : "";
  });
  values.Remark = remarkInput.value.trim();
  return values;
}

function validate(values) {
  const problems = [];

  (schema.fields || []).forEach(f => {
    const value = values[f.id];

    if (f.required !== false && !value) {
      problems.push(`${f.label} is required.`);
      return;
    }

    if (f.type === "number" && value !== "") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < f.min || n > f.max) {
        problems.push(`${f.label} must be an integer between ${f.min} and ${f.max}.`);
      }
    }

    if (f.pattern && value && !new RegExp(f.pattern).test(value)) {
      problems.push(`${f.label} has an invalid format.`);
    }

    if (f.options && value && !f.options.includes(value)) {
      problems.push(`${f.label} has an invalid value.`);
    }
  });

  return problems;
}

function buildCommand() {
  if (!schema) {
    statusEl.textContent = "Select a command first";
    return "";
  }

  const values = getValues();
  const problems = validate(values);

  errors.innerHTML = problems.length
    ? problems.map(x => `<div>• ${escapeHtml(x)}</div>`).join("")
    : "";

  if (problems.length) {
    statusEl.textContent = "Validation error";
    return "";
  }

  const result = String(schema.template || "").replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
  output.textContent = result;
  statusEl.textContent = "Generated";
  return result;
}

function addToScript() {
  const result = buildCommand();
  if (!result) return;

  scriptQueue.push({
    command: result,
    name: schema.name || "MML Command"
  });

  renderScriptQueue();
  statusEl.textContent = `Added to Script (${scriptQueue.length})`;
}

function renderScriptQueue() {
  scriptCount.textContent = scriptQueue.length;

  if (!scriptQueue.length) {
    scriptList.innerHTML = `<div class="script-empty">No commands added yet.</div>`;
    return;
  }

  scriptList.innerHTML = scriptQueue.map((item, index) => `
    <div class="script-row">
      <div class="script-number">${index + 1}</div>
      <div class="script-command">
        <div class="script-name">${escapeHtml(item.name)}</div>
        <code>${escapeHtml(item.command)}</code>
      </div>
      <button type="button" class="remove-script" data-index="${index}" title="Remove command">×</button>
    </div>
  `).join("");

  scriptList.querySelectorAll(".remove-script").forEach(btn => {
    btn.addEventListener("click", () => {
      scriptQueue.splice(Number(btn.dataset.index), 1);
      renderScriptQueue();
      statusEl.textContent = `Script updated (${scriptQueue.length})`;
    });
  });
}

function allScriptText() {
  return scriptQueue.map(item => item.command).join("\n");
}

document.getElementById("generate").addEventListener("click", buildCommand);
document.getElementById("addToScript").addEventListener("click", addToScript);

document.getElementById("copy").addEventListener("click", async () => {
  const text = allScriptText() || output.textContent;
  if (!text || text.startsWith("Select a command")) {
    statusEl.textContent = "Nothing to copy";
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    statusEl.textContent = scriptQueue.length ? "Script copied" : "Command copied";
  } catch {
    statusEl.textContent = "Clipboard access failed";
  }
});

document.getElementById("save").addEventListener("click", () => {
  const text = allScriptText() || output.textContent;
  if (!text || text.startsWith("Select a command")) {
    statusEl.textContent = "Nothing to save";
    return;
  }

  const blob = new Blob([text + "\n"], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "MML_Script.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  statusEl.textContent = "TXT saved";
});

document.getElementById("reset").addEventListener("click", () => {
  if (schema) renderForm();
  remarkInput.value = "";
  errors.innerHTML = "";
  output.textContent = "Fill the parameters, then click Generate or + Add to Script.";
  statusEl.textContent = "Ready";
});

document.getElementById("clearScript").addEventListener("click", () => {
  scriptQueue = [];
  renderScriptQueue();
  statusEl.textContent = "Script cleared";
});

commandSearch.addEventListener("input", event => {
  renderCommandResults(event.target.value);
});

commandSearch.addEventListener("focus", event => {
  renderCommandResults(event.target.value);
});

commandSearch.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    commandResults.classList.remove("show");
  }

  if (event.key === "Enter") {
    const first = commandResults.querySelector(".command-item");
    if (first) {
      event.preventDefault();
      selectCommand(first.dataset.id);
    }
  }
});

document.addEventListener("click", event => {
  if (!event.target.closest(".command-search")) {
    commandResults.classList.remove("show");
  }
});

init();
