(function () {
    "use strict";

    /* =========================
       ANTI COPY DETERRENT
       ========================= */

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
        }

        if ((e.ctrlKey || e.metaKey) && e.shiftKey &&
            ["i", "j", "c"].includes(k)) {
            e.preventDefault();
        }
    });


    /* =========================
       ELEMENTS
       ========================= */

    const fileInput = document.getElementById("mml-file");
    const parseBtn = document.getElementById("parse-btn");
    const resetBtn = document.getElementById("reset-btn");
    const status = document.getElementById("mml-status");
    const table = document.getElementById("result-table");
    const tbody = table.querySelector("tbody");
    const fileName = document.getElementById("file-name");

    const exportBtn =
        document.getElementById("xlsx-btn") ||
        document.getElementById("csv-btn");

    if (exportBtn) {
        exportBtn.textContent = "Download XLSX";
        exportBtn.disabled = true;
    }


    /* =========================
       STATE
       ========================= */

    let tables = {};
    let errors = [];
    let noMatch = [];
    let opSuccess = [];

    let activeSheet = "FAILED";
    let currentPage = 1;
    let rowsPerPage = 25;


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


    /* =========================
       STYLE
       ========================= */

    const css = document.createElement("style");

    css.textContent = `
        body {
            user-select: none;
            -webkit-user-select: none;
        }

        input, textarea, select {
            user-select: text;
            -webkit-user-select: text;
        }

        #mml-tabs {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin: 16px 0 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #ddd;
        }

        .mml-tab {
            padding: 8px 12px;
            border: 1px solid #d9dfe8;
            border-radius: 7px;
            background: #fff;
            cursor: pointer;
            font-weight: 600;
        }

        .mml-tab.active {
            background: #1667d9;
            color: #fff;
            border-color: #1667d9;
        }

        .mml-tab-count {
            margin-left: 4px;
            opacity: .8;
            font-weight: 400;
        }

        #mml-sheet-title {
            margin: 8px 0;
            font-weight: 700;
        }

        #mml-pagination {
            margin: 14px 0;
        }

        .mml-pagination-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .mml-rows-control {
            display: flex;
            align-items: center;
            gap: 7px;
        }

        #mml-rows-select {
            padding: 5px 8px;
            border: 1px solid #d9dfe8;
            border-radius: 6px;
        }

        .mml-pagination-bottom {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 5px;
            flex-wrap: wrap;
        }

        #mml-page-buttons {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
        }

        .mml-page-btn {
            min-width: 34px;
            height: 34px;
            padding: 0 9px;
            border: 1px solid #d9dfe8;
            border-radius: 6px;
            background: #fff;
            cursor: pointer;
        }

        .mml-page-btn.active {
            background: #1667d9;
            color: #fff;
            border-color: #1667d9;
        }

        .mml-page-btn:disabled {
            opacity: .5;
            cursor: not-allowed;
        }

        .mml-page-dots {
            padding: 7px 3px;
        }

        @media (max-width: 600px) {
            .mml-pagination-top {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
            }
        }
    `;

    document.head.appendChild(css);


    /* =========================
       HELPERS
       ========================= */

    function txt(v) {
        return v == null ? "" : String(v);
    }


    function esc(v) {
        return txt(v)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function tableName(command) {
        return command
            .replace(/[^\w]+/g, "_")
            .substring(0, 31);
    }


    function addHeaders(t, row) {
        Object.keys(row).forEach(key => {
            if (!t.header.includes(key)) {
                t.header.push(key);
            }
        });
    }


    /* =========================
       PARSER
       ========================= */

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

                const m = line.match(
                    /\+{3}\s+(.+?)\s+\d{4}-\d{2}-\d{2}/
                );

                if (m) {
                    neName = m[1].trim();
                }

            } else if (line.startsWith("NE :")) {

                neName = line
                    .replace("NE :", "")
                    .trim();

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

            const cm = line.match(
                /(MOD|ADD|RMV|SET|LST|DSP)\s+([A-Z0-9_]+)/
            );

            if (cm) {
                command = `${cm[1]} ${cm[2]}`;
            }


            /* FAILED */

            for (const pattern of failedPatterns) {

                if (line.includes(pattern)) {

                    errors.push([
                        neName,
                        command,
                        line
                    ]);

                    break;
                }
            }


            /* NO MATCH */

            if (line.includes("No matching result")) {

                noMatch.push([
                    neName,
                    command,
                    line
                ]);
            }


            /* SUCCESS */

            if (line.includes("Operation succeeded")) {

                opSuccess.push([
                    neName,
                    command,
                    line
                ]);
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

                    if (row !== "") {
                        block.push(row);
                    }

                    i++;
                }


                if (block.length) {

                    const name = tableName(command);

                    if (!tables[name]) {

                        tables[name] = {
                            header: [
                                "NE_NAME",
                                "MML Command"
                            ],
                            rows: []
                        };
                    }

                    const t = tables[name];


                    /* KEY = VALUE */

                    if (block[0].includes("=")) {

                        const row = {
                            NE_NAME: neName,
                            "MML Command": command
                        };

                        for (const line2 of block) {

                            const m = line2.match(
                                /^(.+?)\s*=\s*(.+)$/
                            );

                            if (!m) continue;

                            const key = m[1].trim();
                            const value = m[2].trim();

                            if (
                                value.includes("&") &&
                                value.includes(":")
                            ) {

                                value.split("&").forEach(sub => {

                                    if (!sub.includes(":")) return;

                                    const p = sub.indexOf(":");

                                    row[
                                        sub.substring(0, p).trim()
                                    ] =
                                        sub.substring(p + 1).trim();
                                });

                            } else {

                                row[key] = value;
                            }
                        }

                        addHeaders(t, row);
                        t.rows.push(row);
                    }


                    /* NORMAL TABLE */

                    else {

                        const header =
                            block[0].split(/\s{2,}/);

                        for (let r = 1; r < block.length; r++) {

                            const cols =
                                block[r].split(/\s{2,}/);

                            const row = {
                                NE_NAME: neName,
                                "MML Command": command
                            };

                            const count =
                                Math.min(
                                    header.length,
                                    cols.length
                                );

                            for (let c = 0; c < count; c++) {

                                const key = header[c];
                                const value = cols[c];

                                if (
                                    value.includes("&") &&
                                    value.includes(":")
                                ) {

                                    value.split("&").forEach(sub => {

                                        if (!sub.includes(":")) return;

                                        const p = sub.indexOf(":");

                                        row[
                                            sub.substring(0, p).trim()
                                        ] =
                                            sub.substring(p + 1).trim();
                                    });

                                } else {

                                    row[key] = value;
                                }
                            }

                            addHeaders(t, row);
                            t.rows.push(row);
                        }
                    }
                }
            }

            i++;
        }
    }


    /* =========================
       SHEET DATA
       ========================= */

    function sheetNames() {

        const result = [
            "FAILED",
            "NO_MATCH",
            "LOG_SUCCESS"
        ];

        Object.keys(tables).forEach(name => {

            if (!result.includes(name)) {
                result.push(name);
            }
        });

        return result;
    }


    function sheetRows(name) {

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

        return tables[name]
            ? tables[name].rows
            : [];
    }


    function sheetHeader(name) {

        if (
            name === "FAILED" ||
            name === "NO_MATCH" ||
            name === "LOG_SUCCESS"
        ) {

            return [
                "NE_NAME",
                "MML Command",
                "Message"
            ];
        }

        return tables[name]
            ? tables[name].header
            : [];
    }
       /* =========================
       OBJECT PREVIEW
       ========================= */

    function getObject(row) {

        const preferred = [
            "NR Cell ID",
            "NR DU Cell TRP ID",
            "NR DU Cell ID",
            "Cell ID",
            "Cell Name",
            "Object ID",
            "Object Name"
        ];

        for (const key of preferred) {

            if (
                row[key] !== undefined &&
                row[key] !== ""
            ) {
                return row[key];
            }
        }

        for (const key of Object.keys(row)) {

            const u = key.toUpperCase();

            if (
                (
                    u.includes("OBJ") ||
                    u.includes("CELL") ||
                    u.includes("TRP")
                ) &&
                row[key] !== undefined &&
                row[key] !== ""
            ) {
                return row[key];
            }
        }

        return "";
    }


    function getRaw(row) {

        return row.Message !== undefined
            ? row.Message
            : "";
    }


    /* =========================
       TABS
       ========================= */

    function createTabs() {

        let tabs =
            document.getElementById("mml-tabs");

        if (!tabs) {

            tabs = document.createElement("div");
            tabs.id = "mml-tabs";

            table.parentNode.insertBefore(
                tabs,
                table
            );
        }

        let title =
            document.getElementById(
                "mml-sheet-title"
            );

        if (!title) {

            title = document.createElement("div");
            title.id = "mml-sheet-title";

            table.parentNode.insertBefore(
                title,
                table
            );
        }

        tabs.innerHTML = "";

        sheetNames().forEach(name => {

            const btn =
                document.createElement("button");

            btn.type = "button";
            btn.className = "mml-tab";

            btn.textContent = name;

            const count =
                document.createElement("span");

            count.className =
                "mml-tab-count";

            count.textContent =
                `(${sheetRows(name).length.toLocaleString()})`;

            btn.appendChild(count);

            if (name === activeSheet) {
                btn.classList.add("active");
            }

            btn.onclick = () => {

                activeSheet = name;
                currentPage = 1;

                createTabs();
                renderPage();
            };

            tabs.appendChild(btn);
        });

        title.textContent =
            `${activeSheet} — ` +
            `${sheetRows(activeSheet).length.toLocaleString()} rows`;
    }


    /* =========================
       PAGINATION
       ========================= */

    function createPagination() {

        if (
            document.getElementById(
                "mml-pagination"
            )
        ) {
            return;
        }

        const box =
            document.createElement("div");

        box.id = "mml-pagination";

        box.innerHTML = `
            <div class="mml-pagination-top">

                <div id="mml-page-info">
                    No data
                </div>

                <div class="mml-rows-control">

                    <label>Rows:</label>

                    <select id="mml-rows-select">
                        <option value="10">10</option>
                        <option value="25" selected>25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </select>

                </div>

            </div>

            <div class="mml-pagination-bottom">

                <button
                    id="mml-prev-btn"
                    class="mml-page-btn"
                    type="button"
                >
                    Previous
                </button>

                <div id="mml-page-buttons"></div>

                <button
                    id="mml-next-btn"
                    class="mml-page-btn"
                    type="button"
                >
                    Next
                </button>

            </div>
        `;

        if (
            exportBtn &&
            exportBtn.parentNode
        ) {

            exportBtn.parentNode.insertBefore(
                box,
                exportBtn
            );

        } else {

            table.parentNode.appendChild(box);
        }


        document
            .getElementById("mml-rows-select")
            .onchange = e => {

                rowsPerPage =
                    Number(e.target.value);

                currentPage = 1;

                renderPage();
            };


        document
            .getElementById("mml-prev-btn")
            .onclick = () => {

                if (currentPage > 1) {

                    currentPage--;

                    renderPage();
                }
            };


        document
            .getElementById("mml-next-btn")
            .onclick = () => {

                const totalPages =
                    Math.max(
                        1,
                        Math.ceil(
                            sheetRows(activeSheet).length /
                            rowsPerPage
                        )
                    );

                if (
                    currentPage <
                    totalPages
                ) {

                    currentPage++;

                    renderPage();
                }
            };
    }


    function pageList(current, total) {

        if (total <= 7) {

            return Array.from(
                {length: total},
                (_, i) => i + 1
            );
        }

        const result = [1];

        if (current > 4) {
            result.push("...");
        }

        for (
            let i = Math.max(2, current - 1);
            i <= Math.min(total - 1, current + 1);
            i++
        ) {
            result.push(i);
        }

        if (current < total - 3) {
            result.push("...");
        }

        result.push(total);

        return result;
    }


    function renderPage() {

        const rows =
            sheetRows(activeSheet);

        const total =
            rows.length;

        const totalPages =
            Math.max(
                1,
                Math.ceil(
                    total /
                    rowsPerPage
                )
            );

        if (
            currentPage > totalPages
        ) {
            currentPage = totalPages;
        }

        const start =
            (currentPage - 1) *
            rowsPerPage;

        const end =
            Math.min(
                start + rowsPerPage,
                total
            );


        tbody.innerHTML = "";


        rows
            .slice(start, end)
            .forEach((row, index) => {

                const tr =
                    document.createElement("tr");

                tr.innerHTML = `
                    <td>${esc(start + index + 1)}</td>
                    <td>${esc(row.NE_NAME)}</td>
                    <td>${esc(row["MML Command"])}</td>
                    <td>${esc(getObject(row))}</td>
                    <td>${esc(getRaw(row))}</td>
                `;

                tbody.appendChild(tr);
            });


        const info =
            document.getElementById(
                "mml-page-info"
            );

        if (info) {

            info.textContent =
                total === 0
                    ? "No data"
                    : `Showing ${start + 1}-${end} of ${total.toLocaleString()}`;
        }


        const buttons =
            document.getElementById(
                "mml-page-buttons"
            );

        if (buttons) {

            buttons.innerHTML = "";

            pageList(
                currentPage,
                totalPages
            ).forEach(page => {

                if (page === "...") {

                    const dots =
                        document.createElement("span");

                    dots.className =
                        "mml-page-dots";

                    dots.textContent = "...";

                    buttons.appendChild(dots);

                    return;
                }

                const btn =
                    document.createElement("button");

                btn.type = "button";
                btn.className = "mml-page-btn";
                btn.textContent = page;

                if (
                    page === currentPage
                ) {
                    btn.classList.add("active");
                }

                btn.onclick = () => {

                    currentPage = page;

                    renderPage();
                };

                buttons.appendChild(btn);
            });
        }


        const prev =
            document.getElementById(
                "mml-prev-btn"
            );

        const next =
            document.getElementById(
                "mml-next-btn"
            );

        if (prev) {
            prev.disabled =
                currentPage <= 1;
        }

        if (next) {
            next.disabled =
                currentPage >= totalPages;
        }
    }


    /* =========================
       STATUS
       ========================= */

    function updateStatus() {

        let data = 0;

        Object.values(tables)
            .forEach(t => {
                data += t.rows.length;
            });

        const total =
            errors.length +
            noMatch.length +
            opSuccess.length +
            data;

        status.textContent =
            `Parsed ${total.toLocaleString()} rows` +
            ` | FAILED: ${errors.length.toLocaleString()}` +
            ` | NO_MATCH: ${noMatch.length.toLocaleString()}` +
            ` | SUCCESS: ${opSuccess.length.toLocaleString()}` +
            ` | DATA: ${data.toLocaleString()}`;
    }


    /* =========================
       SHEETJS
       ========================= */

    function loadXLSX() {

        if (window.XLSX) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {

            const script =
                document.createElement("script");

            script.src =
                "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";

            script.onload = resolve;

            script.onerror = reject;

            document.head.appendChild(script);
        });
    }


    /* =========================
       XLSX EXPORT
       ========================= */

    async function downloadXLSX() {

        try {

            await loadXLSX();

            const wb =
                XLSX.utils.book_new();


            sheetNames().forEach(name => {

                const header =
                    sheetHeader(name);

                const rows =
                    sheetRows(name);

                const data = [
                    header,
                    ...rows.map(row =>
                        header.map(key =>
                            row[key] === undefined
                                ? ""
                                : row[key]
                        )
                    )
                ];

                const ws =
                    XLSX.utils.aoa_to_sheet(data);


                /* Freeze header */

                ws["!freeze"] = {
                    xSplit: 0,
                    ySplit: 1
                };


                /* Autofilter */

                if (ws["!ref"]) {
                    ws["!autofilter"] = {
                        ref: ws["!ref"]
                    };
                }


                /* Column width */

                const range =
                    XLSX.utils.decode_range(
                        ws["!ref"]
                    );

                const widths = [];

                for (
                    let c = range.s.c;
                    c <= range.e.c;
                    c++
                ) {

                    let max = 10;

                    for (
                        let r = range.s.r;
                        r <= range.e.r;
                        r++
                    ) {

                        const cell =
                            ws[
                                XLSX.utils.encode_cell({
                                    r,
                                    c
                                })
                            ];

                        if (
                            cell &&
                            cell.v != null
                        ) {

                            max =
                                Math.max(
                                    max,
                                    String(
                                        cell.v
                                    ).length
                                );
                        }
                    }

                    widths.push({
                        wch:
                            Math.min(
                                max + 2,
                                50
                            )
                    });
                }

                ws["!cols"] = widths;


                XLSX.utils.book_append_sheet(
                    wb,
                    ws,
                    name
                );
            });


            let outputName =
                "MML_Task_Result_parsed.xlsx";

            if (
                fileInput &&
                fileInput.files.length
            ) {

                outputName =
                    fileInput.files[0].name
                        .replace(
                            /\.[^/.]+$/,
                            ""
                        ) +
                    "_parsed.xlsx";
            }


            /*
             * Compression aktif
             */

            XLSX.writeFile(
                wb,
                outputName,
                {
                    compression: true
                }
            );

        } catch (error) {

            console.error(error);

            alert(
                "Failed to create XLSX."
            );
        }
    }


    /* =========================
       PARSE BUTTON
       ========================= */

    parseBtn.addEventListener(
        "click",
        () => {

            if (
                !fileInput.files.length
            ) {

                alert(
                    "Please select an MML file first."
                );

                return;
            }


            const reader =
                new FileReader();


            reader.onload = e => {

                try {

                    parseMML(
                        e.target.result
                    );


                    activeSheet = "FAILED";
                    currentPage = 1;
                    rowsPerPage = 25;


                    createTabs();
                    createPagination();
                    renderPage();
                    updateStatus();


                    if (exportBtn) {
                        exportBtn.disabled = false;
                    }

                } catch (error) {

                    console.error(error);

                    alert(
                        "Failed to parse MML file."
                    );
                }
            };


            reader.onerror = () => {

                alert(
                    "Failed to read the selected file."
                );
            };


            reader.readAsText(
                fileInput.files[0]
            );
        }
    );


    /* =========================
       FILE NAME
       ========================= */

    fileInput.addEventListener(
        "change",
        () => {

            if (fileName) {

                fileName.textContent =
                    fileInput.files.length
                        ? fileInput.files[0].name
                        : "Choose MML TXT or LOG file";
            }
        }
    );


    /* =========================
       EXPORT BUTTON
       ========================= */

    if (exportBtn) {

        exportBtn.addEventListener(
            "click",
            downloadXLSX
        );
    }


    /* =========================
       RESET
       ========================= */

    resetBtn.addEventListener(
        "click",
        () => {

            tables = {};
            errors = [];
            noMatch = [];
            opSuccess = [];

            activeSheet = "FAILED";
            currentPage = 1;


            tbody.innerHTML = "";


            if (status) {
                status.textContent = "Ready";
            }


            if (fileInput) {
                fileInput.value = "";
            }


            if (fileName) {
                fileName.textContent =
                    "Choose MML TXT or LOG file";
            }


            if (exportBtn) {
                exportBtn.disabled = true;
            }


            [
                "mml-tabs",
                "mml-sheet-title",
                "mml-pagination"
            ].forEach(id => {

                const el =
                    document.getElementById(id);

                if (el) el.remove();
            });
        }
    );


    status.textContent = "Ready";

})();
