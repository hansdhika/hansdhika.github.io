from pathlib import Path

js = r'''/* =========================================================
   MML PARSER WEB - FINAL
   - Python-compatible parsing
   - Tab per result sheet
   - Pagination per tab
   - XLSX multi-sheet export
   - SheetJS lazy-load
   - Anti-copy deterrence
   ========================================================= */

(function () {
    "use strict";

    /* ---------- Anti-copy deterrence ---------- */
    document.addEventListener("contextmenu", e => e.preventDefault());

    document.addEventListener("dragstart", e => {
        if (!["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) {
            e.preventDefault();
        }
    });

    document.addEventListener("keydown", e => {
        const k = e.key.toLowerCase();

        if (e.key === "F12") {
            e.preventDefault();
            return;
        }

        if ((e.ctrlKey || e.metaKey) &&
            ["c", "x", "s", "u", "p"].includes(k)) {
            e.preventDefault();
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.shiftKey &&
            ["i", "j", "c"].includes(k)) {
            e.preventDefault();
        }
    });

    const style = document.createElement("style");
    style.textContent = `
        body { user-select:none; -webkit-user-select:none; }
        input, textarea, select { user-select:text; -webkit-user-select:text; }
        img { -webkit-user-drag:none; }

        #mml-tabs {
            display:flex;
            flex-wrap:wrap;
            gap:6px;
            margin:16px 0 12px;
            border-bottom:1px solid #ddd;
            padding-bottom:8px;
        }

        .mml-tab {
            border:1px solid #d9dfe8;
            background:#fff;
            border-radius:7px;
            padding:8px 12px;
            cursor:pointer;
            font-weight:600;
        }

        .mml-tab.active {
            background:#1667d9;
            color:#fff;
            border-color:#1667d9;
        }

        .mml-tab-count {
            font-weight:400;
            opacity:.8;
            margin-left:4px;
        }

        #mml-sheet-title {
            font-weight:700;
            margin:8px 0;
        }

        #mml-pagination {
            margin:14px 0;
        }

        .mml-pagination-top {
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:12px;
            margin-bottom:10px;
            font-size:14px;
        }

        .mml-rows-control {
            display:flex;
            align-items:center;
            gap:7px;
        }

        #mml-rows-select {
            padding:5px 8px;
            border:1px solid #d9dfe8;
            border-radius:6px;
            background:#fff;
        }

        .mml-pagination-bottom {
            display:flex;
            justify-content:center;
            align-items:center;
            gap:5px;
            flex-wrap:wrap;
        }

        #mml-page-buttons {
            display:flex;
            gap:5px;
            flex-wrap:wrap;
            justify-content:center;
        }

        .mml-page-btn {
            min-width:34px;
            height:34px;
            padding:0 9px;
            border:1px solid #d9dfe8;
            border-radius:6px;
            background:#fff;
            cursor:pointer;
        }

        .mml-page-btn.active {
            background:#1667d9;
            color:#fff;
            border-color:#1667d9;
            font-weight:700;
        }

        .mml-page-btn:disabled {
            opacity:.5;
            cursor:not-allowed;
        }

        .mml-page-dots {
            padding:7px 3px;
        }

        @media (max-width:600px) {
            .mml-pagination-top {
                flex-direction:column;
                align-items:flex-start;
            }
        }
    `;
    document.head.appendChild(style);

    /* ---------- Elements ---------- */
    const fileInput = document.getElementById("mml-file");
    const parseBtn = document.getElementById("parse-btn");
    const resetBtn = document.getElementById("reset-btn");
    const status = document.getElementById("mml-status");
    const table = document.getElementById("result-table");
    const tbody = table ? table.querySelector("tbody") : null;
    const fileName = document.getElementById("file-name");

    const exportBtn =
        document.getElementById("xlsx-btn") ||
        document.getElementById("csv-btn");

    if (exportBtn) {
        exportBtn.textContent = "Download XLSX";
        exportBtn.disabled = true;
    }

    /* ---------- State ---------- */
    let tables = {};
    let errors = [];
    let noMatch = [];
    let opSuccess = [];

    let activeSheet = "FAILED";
    let rowsPerPage = 25;
    let currentPage = 1;

    const failedPatterns = [
        "Failure",
        "not connected",
        "Failed to query NE information",
        "Command does not exist",
        "The cell power exceeds the RRU capability",
        "Failed to obtain the cell power license",
        "The object does not exist",
        "Permission denied"
    ];

    function text(v) {
        return v === undefined || v === null ? "" : String(v);
    }

    function escapeHTML(v) {
        return text(v)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function makeTableName(command) {
        return command.replace(/[^\w]+/g, "_").substring(0, 31);
    }

    function addHeaders(t, row) {
        Object.keys(row).forEach(k => {
            if (!t.header.includes(k)) t.header.push(k);
        });
    }

    function parseMML(sourceText) {
        const lines = sourceText.split(/\r?\n/);

        tables = {};
        errors = [];
        noMatch = [];
        opSuccess = [];

        let neName = "";
        let command = "";
        let i = 0;

        while (i < lines.length) {
            const line = lines[i].trim();

            /* NE NAME */
            if (line.includes("+++")) {
                const m = line.match(/\+{3}\s+(.+?)\s+\d{4}-\d{2}-\d{2}/);
                if (m) neName = m[1].trim();
            } else if (line.startsWith("NE :")) {
                neName = line.replace("NE :", "").trim();
            } else if (
                line.includes("#") &&
                !line.includes("+++") &&
                !line.startsWith("%%") &&
                !line.startsWith("O&M") &&
                !line.startsWith("---")
            ) {
                neName = line.trim();
            }

            /* COMMAND */
            const commandMatch =
                line.match(/(MOD|ADD|RMV|SET|LST|DSP)\s+([A-Z0-9_]+)/);

            if (commandMatch) {
                command = `${commandMatch[1]} ${commandMatch[2]}`;
            }

            /* FAILED */
            for (const pattern of failedPatterns) {
                if (line.includes(pattern)) {
                    errors.push([neName, command, line]);
                    break;
                }
            }

            /* NO MATCH */
            if (line.includes("No matching result")) {
                noMatch.push([neName, command, line]);
            }

            /* SUCCESS */
            if (line.includes("Operation succeeded")) {
                opSuccess.push([neName, command, line]);
            }

            /* RESULT BLOCK */
            if (line.startsWith("------------")) {
                i++;
                const block = [];

                while (i < lines.length) {
                    const row = lines[i].trim();

                    if (
                        row.startsWith("(Number of results") ||
                        row.startsWith("---")
                    ) {
                        break;
                    }

                    if (row !== "") block.push(row);
                    i++;
                }

                if (block.length > 0) {
                    const tableName = makeTableName(command);

                    if (!tables[tableName]) {
                        tables[tableName] = {
                            header: ["NE_NAME", "MML Command"],
                            rows: []
                        };
                    }

                    const t = tables[tableName];

                    /* KEY = VALUE */
                    if (block[0].includes("=")) {
                        const rowDict = {
                            NE_NAME: neName,
                            "MML Command": command
                        };

                        for (const r of block) {
                            const m = r.match(/^(.+?)\s*=\s*(.+)$/);
                            if (!m) continue;

                            const k = m[1].trim();
                            const v = m[2].trim();

                            if (v.includes("&") && v.includes(":")) {
                                for (const sub of v.split("&")) {
                                    if (!sub.includes(":")) continue;

                                    const p = sub.indexOf(":");
                                    const sk = sub.substring(0, p).trim();
                                    const sv = sub.substring(p + 1).trim();

                                    rowDict[sk] = sv;
                                }
                            } else {
                                rowDict[k] = v;
                            }
                        }

                        addHeaders(t, rowDict);
                        t.rows.push(rowDict);
                    }

                    /* NORMAL TABLE */
                    else {
                        const headerLine = block[0].split(/\s{2,}/);

                        for (let r = 1; r < block.length; r++) {
                            const cols = block[r].split(/\s{2,}/);

                            const rowDict = {
                                NE_NAME: neName,
                                "MML Command": command
                            };

                            const count = Math.min(
                                headerLine.length,
                                cols.length
                            );

                            for (let c = 0; c < count; c++) {
                                const h = headerLine[c];
                                const v = cols[c];

                                if (v.includes("&") && v.includes(":")) {
                                    for (const sub of v.split("&")) {
                                        if (!sub.includes(":")) continue;

                                        const p = sub.indexOf(":");
                                        const sk = sub.substring(0, p).trim();
                                        const sv = sub.substring(p + 1).trim();

                                        rowDict[sk] = sv;
                                    }
                                } else {
                                    rowDict[h] = v;
                                }
                            }

                            addHeaders(t, rowDict);
                            t.rows.push(rowDict);
                        }
                    }
                }
            }

            i++;
        }
    }

    /* ---------- Sheet helpers ---------- */
    function getSheetRows(name) {
        if (name === "FAILED") {
            return errors.map(r => ({
                NE_NAME: r[0],
                "MML Command": r[1],
                Message: r[2]
            }));
        }

        if (name === "NO_MATCH") {
            return noMatch.map(r => ({
                NE_NAME: r[0],
                "MML Command": r[1],
                Message: r[2]
            }));
        }

        if (name === "LOG_SUCCESS") {
            return opSuccess.map(r => ({
                NE_NAME: r[0],
                "MML Command": r[1],
                Message: r[2]
            }));
        }

        return tables[name] ? tables[name].rows : [];
    }

    function getSheetHeader(name) {
        if (
            name === "FAILED" ||
            name === "NO_MATCH" ||
            name === "LOG_SUCCESS"
        ) {
            return ["NE_NAME", "MML Command", "Message"];
        }

        return tables[name] ? tables[name].header : [];
    }

    function getSheetNames() {
        const names = ["FAILED", "NO_MATCH", "LOG_SUCCESS"];

        Object.keys(tables).forEach(name => {
            if (!names.includes(name)) names.push(name);
        });

        return names;
    }

    function getObject(row) {
        const keys = [
            "NR Cell ID",
            "NR DU Cell TRP ID",
            "NR DU Cell ID",
            "Cell ID",
            "Cell Name",
            "Object ID",
            "Object Name"
        ];

        for (const k of keys) {
            if (row[k] !== undefined && row[k] !== "") return row[k];
        }

        for (const k of Object.keys(row)) {
            const u = k.toUpperCase();

            if (
                (u.includes("OBJ") ||
                 u.includes("CELL") ||
                 u.includes("TRP")) &&
                row[k] !== undefined &&
                row[k] !== ""
            ) {
                return row[k];
            }
        }

        return "";
    }

    function getRaw(row) {
        return row.Message !== undefined ? row.Message : "";
    }

    /* ---------- Build tab UI ---------- */
    function createSheetUI() {
        let tabs = document.getElementById("mml-tabs");

        if (!tabs) {
            tabs = document.createElement("div");
            tabs.id = "mml-tabs";

            if (table && table.parentNode) {
                table.parentNode.insertBefore(tabs, table);
            }
        }

        let title = document.getElementById("mml-sheet-title");

        if (!title) {
            title = document.createElement("div");
            title.id = "mml-sheet-title";

            if (table && table.parentNode) {
                table.parentNode.insertBefore(title, table);
            }
        }

        tabs.innerHTML = "";

        getSheetNames().forEach(name => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "mml-tab";
            btn.textContent = name;

            const count = document.createElement("span");
            count.className = "mml-tab-count";
            count.textContent =
                `(${getSheetRows(name).length.toLocaleString()})`;

            btn.appendChild(count);

            if (name === activeSheet) {
                btn.classList.add("active");
            }

            btn.addEventListener("click", () => {
                activeSheet = name;
                currentPage = 1;
                createSheetUI();
                renderPage();
            });

            tabs.appendChild(btn);
        });

        title.textContent =
            `${activeSheet} — ${getSheetRows(activeSheet).length.toLocaleString()} rows`;
    }

    /* ---------- Pagination ---------- */
    function createPagination() {
        let p = document.getElementById("mml-pagination");
        if (p) return p;

        p = document.createElement("div");
        p.id = "mml-pagination";

        p.innerHTML = `
            <div class="mml-pagination-top">
                <div id="mml-page-info">No data</div>
                <div class="mml-rows-control">
                    <label for="mml-rows-select">Rows:</label>
                    <select id="mml-rows-select">
                        <option value="10">10</option>
                        <option value="25" selected>25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </select>
                </div>
            </div>

            <div class="mml-pagination-bottom">
                <button type="button" id="mml-prev-btn"
                        class="mml-page-btn">Previous</button>
                <div id="mml-page-buttons"></div>
                <button type="button" id="mml-next-btn"
                        class="mml-page-btn">Next</button>
            </div>
        `;

        if (exportBtn && exportBtn.parentNode) {
            exportBtn.parentNode.insertBefore(p, exportBtn);
        } else if (table && table.parentNode) {
            table.parentNode.appendChild(p);
        }

        document.getElementById("mml-rows-select")
            .addEventListener("change", e => {
                rowsPerPage = parseInt(e.target.value, 10);
                currentPage = 1;
                renderPage();
            });

        document.getElementById("mml-prev-btn")
            .addEventListener("click", () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderPage();
                }
            });

        document.getElementById("mml-next-btn")
            .addEventListener("click", () => {
                const totalPages = Math.max(
                    1,
                    Math.ceil(
                        getSheetRows(activeSheet).length /
                        rowsPerPage
                    )
                );

                if (currentPage < totalPages) {
                    currentPage++;
                    renderPage();
                }
            });

        return p;
    }

    function pageNumbers(current, total) {
        if (total <= 7) {
            return Array.from({length: total}, (_, i) => i + 1);
        }

        const out = [1];

        if (current > 4) out.push("...");

        for (
            let i = Math.max(2, current - 1);
            i <= Math.min(total - 1, current + 1);
            i++
        ) {
            out.push(i);
        }

        if (current < total - 3) out.push("...");

        out.push(total);
        return out;
    }

    function renderPage() {
        if (!tbody) return;

        const rows = getSheetRows(activeSheet);
        const total = rows.length;
        const totalPages = Math.max(
            1,
            Math.ceil(total / rowsPerPage)
        );

        if (currentPage > totalPages) currentPage = totalPages;

        const start = total === 0
            ? 0
            : (currentPage - 1) * rowsPerPage;

        const end = Math.min(
            start + rowsPerPage,
            total
        );

        tbody.innerHTML = "";

        rows.slice(start, end).forEach((row, idx) => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${escapeHTML(start + idx + 1)}</td>
                <td>${escapeHTML(row.NE_NAME)}</td>
                <td>${escapeHTML(row["MML Command"])}</td>
                <td>${escapeHTML(getObject(row))}</td>
                <td>${escapeHTML(getRaw(row))}</td>
            `;

            tbody.appendChild(tr);
        });

        createPagination();

        const info = document.getElementById("mml-page-info");
        if (info) {
            info.textContent = total === 0
                ? "No data"
                : `Showing ${start + 1}-${end} of ${total.toLocaleString()}`;
        }

        const buttons = document.getElementById("mml-page-buttons");
        if (buttons) {
            buttons.innerHTML = "";

            pageNumbers(currentPage, totalPages).forEach(page => {
                if (page === "...") {
                    const dots = document.createElement("span");
                    dots.className = "mml-page-dots";
                    dots.textContent = "...";
                    buttons.appendChild(dots);
                    return;
                }

                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "mml-page-btn";
                btn.textContent = page;

                if (page === currentPage) {
                    btn.classList.add("active");
                }

                btn.addEventListener("click", () => {
                    currentPage = page;
                    renderPage();
                });

                buttons.appendChild(btn);
            });
        }

        const prev = document.getElementById("mml-prev-btn");
        const next = document.getElementById("mml-next-btn");

        if (prev) prev.disabled = currentPage <= 1;
        if (next) next.disabled = currentPage >= totalPages;
    }

    /* ---------- Status ---------- */
    function updateStatus() {
        let dataRows = 0;

        Object.values(tables).forEach(t => {
            dataRows += t.rows.length;
        });

        if (status) {
            status.textContent =
                `Parsed ${(errors.length + noMatch.length +
                opSuccess.length + dataRows).toLocaleString()} rows` +
                ` | FAILED: ${errors.length.toLocaleString()}` +
                ` | NO_MATCH: ${noMatch.length.toLocaleString()}` +
                ` | SUCCESS: ${opSuccess.length.toLocaleString()}` +
                ` | DATA: ${dataRows.toLocaleString()}`;
        }
    }

    /* ---------- SheetJS ---------- */
    function loadXLSX() {
        if (window.XLSX) return Promise.resolve();

        return new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src =
                "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";

            s.onload = resolve;
            s.onerror = () =>
                reject(new Error("Failed to load SheetJS"));

            document.head.appendChild(s);
        });
    }

    function makeAOA(name) {
        const header = getSheetHeader(name);
        const rows = getSheetRows(name);

        return [
            header,
            ...rows.map(row =>
                header.map(key =>
                    row[key] === undefined ? "" : row[key]
                )
            )
        ];
    }

    function prepareWorksheet(ws) {
        if (!ws["!ref"]) return;

        ws["!freeze"] = {xSplit: 0, ySplit: 1};
        ws["!autofilter"] = {ref: ws["!ref"]};

        const range = XLSX.utils.decode_range(ws["!ref"]);
        const widths = [];

        for (let c = range.s.c; c <= range.e.c; c++) {
            let max = 10;

            for (let r = range.s.r; r <= range.e.r; r++) {
                const cell = ws[
                    XLSX.utils.encode_cell({r, c})
                ];

                if (
                    cell &&
                    cell.v !== undefined &&
                    cell.v !== null
                ) {
                    max = Math.max(
                        max,
                        String(cell.v).length
                    );
                }
            }

            widths.push({
                wch: Math.min(max + 2, 50)
            });
        }

        ws["!cols"] = widths;
    }

    async function downloadXLSX() {
        try {
            await loadXLSX();

            const wb = XLSX.utils.book_new();

            getSheetNames().forEach(name => {
                const ws = XLSX.utils.aoa_to_sheet(
                    makeAOA(name)
                );

                prepareWorksheet(ws);

                XLSX.utils.book_append_sheet(
                    wb,
                    ws,
                    name
                );
            });

            let outputName = "MML_Task_Result_parsed.xlsx";

            if (fileInput && fileInput.files.length) {
                outputName =
                    fileInput.files[0].name
                        .replace(/\.[^/.]+$/, "") +
                    "_parsed.xlsx";
            }

            /*
             * compression:true is important.
             * Browser XLSX can otherwise become much larger
             * than the Python/openpyxl result.
             */
            XLSX.writeFile(
                wb,
                outputName,
                {
                    compression: true
                }
            );

        } catch (err) {
            console.error(err);
            alert(
                "Failed to create XLSX. Please check your connection and try again."
            );
        }
    }

    /* ---------- Parse ---------- */
    parseBtn.addEventListener("click", () => {
        if (!fileInput || !fileInput.files.length) {
            alert("Please select an MML file first.");
            return;
        }

        const reader = new FileReader();

        reader.onload = e => {
            try {
                parseMML(e.target.result);

                activeSheet = "FAILED";
                currentPage = 1;
                rowsPerPage = 25;

                createSheetUI();
                createPagination();
                renderPage();
                updateStatus();

                if (exportBtn) {
                    exportBtn.disabled = false;
                }
            } catch (err) {
                console.error(err);
                alert("Failed to parse MML file.");
            }
        };

        reader.onerror = () => {
            alert("Failed to read the selected file.");
        };

        reader.readAsText(fileInput.files[0]);
    });

    /* ---------- File name ---------- */
    if (fileInput) {
        fileInput.addEventListener("change", () => {
            if (fileName) {
                fileName.textContent =
                    fileInput.files.length
                        ? fileInput.files[0].name
                        : "Choose MML TXT or LOG file";
            }
        });
    }

    /* ---------- Reset ---------- */
    resetBtn.addEventListener("click", () => {
        tables = {};
        errors = [];
        noMatch = [];
        opSuccess = [];

        activeSheet = "FAILED";
        currentPage = 1;

        if (tbody) tbody.innerHTML = "";
        if (fileInput) fileInput.value = "";

        if (fileName) {
            fileName.textContent =
                "Choose MML TXT or LOG file";
        }

        if (status) status.textContent = "Ready";
        if (exportBtn) exportBtn.disabled = true;

        const tabs = document.getElementById("mml-tabs");
        const title = document.getElementById("mml-sheet-title");
        const pagination = document.getElementById("mml-pagination");

        if (tabs) tabs.remove();
        if (title) title.remove();
        if (pagination) pagination.remove();
    });

    if (status) status.textContent = "Ready";

})();
'''

path = Path("/mnt/data/mml-parser-tabs-final.js")
path.write_text(js, encoding="utf-8")

print(f"Created: {path}")
print(f"Size: {path.stat().st_size / 1024:.1f} KB")
