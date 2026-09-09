const form = document.getElementById("form");
const errors = document.getElementById("errors");
const output = document.getElementById("output");
const statusEl = document.getElementById("status");
let schema;

async function init() {
  schema = await fetch("commands/MOD_EUTRANINTRAFREQNCELL.json").then(r => r.json());
  renderForm();
}
function renderForm() {
  form.innerHTML = '<div class="grid">' + schema.fields.map(f => {
    const control = f.type === "select"
      ? `<select id="${f.id}">${f.options.map(x => `<option ${x===f.default?"selected":""}>${x}</option>`).join("")}</select>`
      : `<input id="${f.id}" type="${f.type}" value="${f.default ?? ""}" ${f.min !== undefined ? `min="${f.min}" max="${f.max}"` : ""}>`;
    return `<div class="field"><label for="${f.id}">${f.label}</label>${control}${f.hint ? `<small>${f.hint}</small>` : ""}</div>`;
  }).join("") + '</div>';
}
function values() {
  const v = {};
  schema.fields.forEach(f => v[f.id] = document.getElementById(f.id).value.trim());
  return v;
}
function validate(v) {
  const e = [];
  schema.fields.forEach(f => {
    const value = v[f.id];
    if (!value) { e.push(`${f.label} is required.`); return; }
    if (f.type === "number") {
      const n = Number(value);
      if (!Number.isInteger(n) || n < f.min || n > f.max)
        e.push(`${f.label} must be an integer between ${f.min} and ${f.max}.`);
    }
    if (f.pattern && !new RegExp(f.pattern).test(value))
      e.push(`${f.label} has an invalid format.`);
    if (f.options && !f.options.includes(value))
      e.push(`${f.label} has an invalid value.`);
  });
  return e;
}
function generate() {
  const v = values();
  const e = validate(v);
  errors.innerHTML = e.length ? e.map(x => `<div>• ${x}</div>`).join("") : "";
  if (e.length) {
    statusEl.textContent = "Validation Error";
    return "";
  }
  const result = schema.template.replace(/\{(\w+)\}/g, (_, k) => v[k]);
  output.textContent = result;
  statusEl.textContent = "Generated";
  return result;
}
document.getElementById("generate").onclick = generate;
document.getElementById("copy").onclick = async () => {
  const result = output.textContent;
  if (!result || result.startsWith("Click Generate")) generate();
  if (output.textContent && !output.textContent.startsWith("Click Generate"))
    await navigator.clipboard.writeText(output.textContent);
  statusEl.textContent = "Copied";
};
document.getElementById("save").onclick = () => {
  const result = generate();
  if (!result) return;
  const blob = new Blob([result + "\n"], {type:"text/plain;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "MOD_EUTRANINTRAFREQNCELL.txt";
  a.click();
  URL.revokeObjectURL(a.href);
};
document.getElementById("reset").onclick = () => {
  renderForm();
  errors.innerHTML = "";
  output.textContent = "Click Generate to create the MML command.";
  statusEl.textContent = "Ready";
};
init();
