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
    commands = await fetch("commands/index.json").then(r => {
      if (!r.ok) throw new Error("Unable to load command index.");
      return r.json();
    });
    renderCommandResults("");
    renderScriptQueue();
    statusEl.textContent = "Ready";
  } catch (err) {
    statusEl.textContent = "Load Error";
    commandResults.innerHTML = `<div class="command-empty">${escapeHtml(err.message)}</div>`;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[ch]));
}

function renderCommandResults(query) {
  const q = query.trim().toLowerCase();
  const matches = commands.filter(c =>
    !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
  );

  commandResults.innerHTML = matches.length
    ? matches.map(c => `
      <button type="button" class="command-item" data-id="${escapeHtml(c.id)}">
        <strong>${escapeHtml(c.name)}</strong>
        <small>${escapeHtml(c.id)}</small>
      </button>`).join("")
    : `<div class="command-empty">No command found.</div>`;

  commandResults.classList.add("show");
  commandResults.querySelectorAll(".command-item").forEach(btn => {
    btn.addEventListener("click", () => selectCommand(btn.dataset.id));
  });
}

async function selectCommand(id) {
  const item = commands.find(c => c.id === id);
  if (!item) return;

  try {
    schema = await fetch(`commands/${encodeURIComponent(item.file)}`).then(r => {
      if (!r.ok) throw new Error("Unable to load command definition.");
      return r.json();
    });

    commandSearch.value = schema.name;
    selectedCommandEl.textContent = schema.name;
    commandDescription.textContent = schema.description || "";
    commandResults.classList.remove("show");
    remarkInput.value = "";
    renderForm();
    errors.innerHTML = "";
    output.textContent = "Fill the parameters, then click Generate or + Add to Script.";
    statusEl.textContent = "Command Loaded";
  } catch (err) {
    statusEl.textContent = "Load Error";
    errors.innerHTML = `<div>• ${escapeHtml(err.message)}</div>`;
  }
}

function renderForm() {
  if (!schema) {
    form.innerHTML = "";
    return;
  }

  form.innerHTML = '<div class="grid">' + schema.fields.map(f => {
    const control = f.type === "select"
      ? `<select id="${f.id}">
          <option value="" selected>- Please Select -</option>
          ${f.options.map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("")}
        </select>`
      : `<input id="${f.id}" type="${f.type}" value="" ${f.min !== undefined ? `min="${f.min}" max="${f.max}"` : ""} placeholder="Please enter">`;

    return `<div class="field">
      <label for="${f.id}">${escapeHtml(f.label)}</label>
      ${control}
      ${f.hint ? `<small>${escapeHtml(f.hint)}</small>` : ""}
    </div>`;
  }).join("") + '</div>';
}

function getValues() {
  const v = {};
  schema.fields.forEach(f => {
    v[f.id] = document.getElementById(f.id)?.value.trim() || "";
  });
  v.Remark = remarkInput.value.trim();
  return v;
}

function validate(v) {
  const e = [];
  schema.fields.forEach(f => {
    const value = v[f.id];
    if (f.required !== false && !value) {
      e.push(`${f.label} is required.`);
      return;
    }
    if (f.type === "number" && value !== "") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < f.min || n > f.max) {
        e.push(`${f.label} must be an integer between ${f.min} and ${f.max}.`);
      }
    }
    if (f.pattern && value && !new RegExp(f.pattern).test(value)) {
      e.push(`${f.label} has an invalid format.`);
    }
    if (f.options && value && !f.options.includes(value)) {
      e.push(`${f.label} has an invalid value.`);
    }
  });
  return e;
}

function buildCommand() {
  if (!schema) {
    statusEl.textContent = "Select Command";
    return "";
  }

  const v = getValues();
  const e = validate(v);
  errors.innerHTML = e.length ? e.map(x => `<div>• ${escapeHtml(x)}</div>`).join("") : "";

  if (e.length) {
    statusEl.textContent = "Validation Error";
    return "";
  }

  const result = schema.template.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
  output.textContent = result;
  statusEl.textContent = "Generated";
  return result;
}

function generate() {
  return buildCommand();
}

function addToScript() {
  const result = buildCommand();
  if (!result) return;

  scriptQueue.push({
    command: result,
    name: schema.name
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

  scriptList.innerHTML = scriptQueue.map((item, i) => `
    <div class="script-row">
      <div class="script-number">${i + 1}</div>
      <div class="script-command">
        <div class="script-name">${escapeHtml(item.name)}</div>
        <code>${escapeHtml(item.command)}</code>
      </div>
      <button type="button" class="remove-script" data-index="${i}" title="Remove command">×</button>
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
  return scriptQueue.map(x => x.command).join("\n");
}

document.getElementById("generate").onclick = generate;
document.getElementById("addToScript").onclick = addToScript;

document.getElementById("copy").onclick = async () => {
  const text = allScriptText() || output.textContent;
  if (!text || text.startsWith("Select a command")) {
    statusEl.textContent = "Nothing to copy";
    return;
  }
  await navigator.clipboard.writeText(text);
  statusEl.textContent = scriptQueue.length ? "Script Copied" : "Command Copied";
};

document.getElementById("save").onclick = () => {
  const text = allScriptText() || output.textContent;
  if (!text || text.startsWith("Select a command")) {
    statusEl.textContent = "Nothing to save";
    return;
  }

  const blob = new Blob([text + "\n"], {type: "text/plain;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "MML_Script.txt";
  a.click();
  URL.revokeObjectURL(a.href);
  statusEl.textContent = "TXT Saved";
};

document.getElementById("reset").onclick = () => {
  if (schema) renderForm();
  remarkInput.value = "";
  errors.innerHTML = "";
  output.textContent = "Fill the parameters, then click Generate or + Add to Script.";
  statusEl.textContent = "Ready";
};

document.getElementById("clearScript").onclick = () => {
  scriptQueue = [];
  renderScriptQueue();
  statusEl.textContent = "Script Cleared";
};

commandSearch.addEventListener("input", () => renderCommandResults(commandSearch.value));
commandSearch.addEventListener("focus", () => renderCommandResults(commandSearch.value));

document.addEventListener("click", e => {
  if (!e.target.closest(".command-search")) commandResults.classList.remove("show");
});

init();
