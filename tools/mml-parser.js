/* =========================================================
   MML PARSER WEB
   Python-compatible parser
   - Local browser parsing
   - FAILED / NO_MATCH / LOG_SUCCESS
   - Dynamic command tables
   - Key = Value parsing
   - Table parsing
   - Sub-parameter parsing
   - Pagination
   - XLSX export
   ========================================================= */


/* =========================================================
   BASIC COPY DETERRENCE
   ========================================================= */

document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
});

document.addEventListener("dragstart", function (e) {
    if (!["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) {
        e.preventDefault();
    }
});

document.addEventListener("keydown", function (e) {

    if (e.key === "F12") {
        e.preventDefault();
        return;
    }

    if (e.ctrlKey || e.metaKey) {

        const key = e.key.toLowerCase();

        if (["c", "x", "s", "u", "p"].includes(key)) {
            e.preventDefault();
            return;
        }
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {

        const key = e.key.toLowerCase();

        if (["i", "j", "c"].includes(key)) {
            e.preventDefault();
        }
    }
});


/* =========================================================
   STYLE
   ========================================================= */

const protectionStyle = document.createElement("style");

protectionStyle.textContent = `

    body {
        user-select: none;
        -webkit-user-select: none;
    }

    input,
    textarea,
    select {
        user-select: text;
        -webkit-user-select: text;
    }

    img {
        -webkit-user-drag: none;
    }

    #mml-pagination {
        margin-top: 18px;
        margin-bottom: 14px;
    }

    .mml-pagination-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 15px;
        margin-bottom: 12px;
        font-size: 14px;
    }

    .mml-rows-control {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    #mml-rows-select {
        padding: 6px 10px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: white;
    }

    .mml-pagination-bottom {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
    }

    #mml-page-buttons {
        display: flex;
        gap: 5px;
        flex-wrap: wrap;
        justify-content: center;
    }

    .mml-page-btn {
        min-width: 36px;
        height: 36px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: white;
        cursor: pointer;
    }

    .mml-page-btn.active {
        font-weight: bold;
    }

    .mml-page-dots {
        padding: 8px 4px;
    }

    button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }

    @media (max-width: 600px) {

        .mml-pagination-top {
            flex-direction: column;
            align-items: flex-start;
        }

    }

`;

document.head.appendChild(protectionStyle);


/* =========================================================
   MAIN
   ========================================================= */

(function () {

    "use strict";


    /* =====================================================
       ELEMENTS
       ===================================================== */

    const fileInput =
        document.getElementById("mml-file");

    const parseBtn =
        document.getElementById("parse-btn");

    const resetBtn =
        document.getElementById("reset-btn");

    const xlsxBtn =
        document.getElementById("xlsx-btn");

    const status =
        document.getElementById("mml-status");

    const table =
        document.getElementById("result-table");

    const tbody =
        table.querySelector("tbody");

    const fileName =
        document.getElementById("file-name");


    /* =====================================================
       GLOBAL DATA
       ===================================================== */

    let allResults = [];

    let tables = {};

    let errors = [];

    let noMatch = [];

    let opSuccess = [];

    let currentPage = 1;

    let rowsPerPage = 25;


    /* =====================================================
       FAILED PATTERNS

       Sama dengan Python
       ===================================================== */

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


    /* =====================================================
       TEXT HELPER
       ===================================================== */

    function text(value) {

        if (
            value === undefined ||
            value === null
        ) {
            return "";
        }

        return String(value);
    }


    /* =====================================================
       TABLE NAME

       Python:
       re.sub(r'\W+', "_", command)[:31]
       ===================================================== */

    function makeTableName(command) {

        return command
            .replace(/[^\w]+/g, "_")
            .substring(0, 31);
    }


    /* =====================================================
       ADD DYNAMIC HEADERS
       ===================================================== */

    function addHeaders(
        tableData,
        rowDict
    ) {

        Object.keys(rowDict).forEach(
            function (key) {

                if (
                    !tableData.header
                        .includes(key)
                ) {

                    tableData.header.push(key);
                }

            }
        );
    }


    /* =====================================================
       PARSE MML
       ===================================================== */

    function parseMML(sourceText) {

        const lines =
            sourceText.split(/\r?\n/);


        tables = {};

        errors = [];

        noMatch = [];

        opSuccess = [];


        let neName = "";

        let command = "";

        let i = 0;


        while (i < lines.length) {

            const line =
                lines[i].trim();


            /* =============================================
               NE NAME
               ============================================= */

            if (line.includes("+++")) {

                const m =
                    line.match(
                        /\+{3}\s+(.+?)\s+\d{4}-\d{2}-\d{2}/
                    );


                if (m) {

                    neName =
                        m[1].trim();
                }

            }

            else if (
                line.startsWith("NE :")
            ) {

                neName =
                    line
                        .replace("NE :", "")
                        .trim();
            }

            else if (

                line.includes("#") &&

                !line.includes("+++") &&

                !line.startsWith("%%") &&

                !line.startsWith("O&M") &&

                !line.startsWith("---")

            ) {

                neName =
                    line.trim();
            }


            /* =============================================
               COMMAND
               ============================================= */

            const commandMatch =
                line.match(
                    /(MOD|ADD|RMV|SET|LST|DSP)\s+([A-Z0-9_]+)/
                );


            if (commandMatch) {

                command =
                    `${commandMatch[1]} ${commandMatch[2]}`;
            }


            /* =============================================
               FAILED
               ============================================= */

            for (
                const pattern
                of failedPatterns
            ) {

                if (
                    line.includes(pattern)
                ) {

                    errors.push([
                        neName,
                        command,
                        line
                    ]);

                    break;
                }
            }


            /* =============================================
               NO MATCH
               ============================================= */

            if (
                line.includes(
                    "No matching result"
                )
            ) {

                noMatch.push([
                    neName,
                    command,
                    line
                ]);
            }


            /* =============================================
               SUCCESS
               ============================================= */

            if (
                line.includes(
                    "Operation succeeded"
                )
            ) {

                opSuccess.push([
                    neName,
                    command,
                    line
                ]);
            }


            /* =============================================
               TABLE BLOCK
               ============================================= */

            if (
                line.startsWith(
                    "------------"
                )
            ) {

                i++;

                const block = [];


                while (
                    i < lines.length
                ) {

                    const row =
                        lines[i].trim();


                    if (

                        row.startsWith(
                            "(Number of results"
                        ) ||

                        row.startsWith("---")

                    ) {

                        break;
                    }


                    if (row !== "") {

                        block.push(row);
                    }


                    i++;
                }


                if (
                    block.length > 0
                ) {

                    const tableName =
                        makeTableName(
                            command
                        );


                    if (
                        !tables[tableName]
                    ) {

                        tables[tableName] = {

                            header: [
                                "NE_NAME",
                                "MML Command"
                            ],

                            rows: []
                        };
                    }


                    /* =====================================
                       KEY = VALUE
                       ===================================== */

                    if (
                        block[0].includes("=")
                    ) {

                        const rowDict = {

                            "NE_NAME":
                                neName,

                            "MML Command":
                                command

                        };


                        for (
                            const r
                            of block
                        ) {

                            const m =
                                r.match(
                                    /^(.+?)\s*=\s*(.+)$/
                                );


                            if (!m) {
                                continue;
                            }


                            const k =
                                m[1].trim();

                            const v =
                                m[2].trim();


                            /* =================================
                               SUB PARAMETERS

                               Example:
                               A:1&B:2&C:3
                               ================================= */

                            if (

                                v.includes("&") &&

                                v.includes(":")

                            ) {

                                const subParams =
                                    v.split("&");


                                for (
                                    const sub
                                    of subParams
                                ) {

                                    if (
                                        !sub.includes(":")
                                    ) {
                                        continue;
                                    }


                                    const separator =
                                        sub.indexOf(":");


                                    const sk =
                                        sub
                                            .substring(
                                                0,
                                                separator
                                            )
                                            .trim();


                                    const sv =
                                        sub
                                            .substring(
                                                separator + 1
                                            )
                                            .trim();


                                    rowDict[sk] =
                                        sv;
                                }

                            }

                            else {

                                rowDict[k] =
                                    v;
                            }
                        }


                        addHeaders(
                            tables[tableName],
                            rowDict
                        );


                        tables[tableName]
                            .rows
                            .push(rowDict);
                    }


                    /* =====================================
                       NORMAL TABLE
                       ===================================== */

                    else {

                        const headerLine =
                            block[0]
                                .split(/\s{2,}/);


                        for (
                            let r = 1;
                            r < block.length;
                            r++
                        ) {

                            const cols =
                                block[r]
                                    .split(/\s{2,}/);


                            const rowDict = {

                                "NE_NAME":
                                    neName,

                                "MML Command":
                                    command

                            };


                            const count =
                                Math.min(
                                    headerLine.length,
                                    cols.length
                                );


                            for (
                                let c = 0;
                                c < count;
                                c++
                            ) {

                                const h =
                                    headerLine[c];

                                const v =
                                    cols[c];


                                if (

                                    v.includes("&") &&

                                    v.includes(":")

                                ) {

                                    const subParams =
                                        v.split("&");


                                    for (
                                        const sub
                                        of subParams
                                    ) {

                                        if (
                                            !sub.includes(":")
                                        ) {
                                            continue;
                                        }


                                        const separator =
                                            sub.indexOf(":");


                                        const sk =
                                            sub
                                                .substring(
                                                    0,
                                                    separator
                                                )
                                                .trim();


                                        const sv =
                                            sub
                                                .substring(
                                                    separator + 1
                                                )
                                                .trim();


                                        rowDict[sk] =
                                            sv;
                                    }

                                }

                                else {

                                    rowDict[h] =
                                        v;
                                }
                            }


                            addHeaders(
                                tables[tableName],
                                rowDict
                            );


                            tables[tableName]
                                .rows
                                .push(rowDict);
                        }
                    }
                }
            }


            i++;
        }


        /* =============================================
           FLATTEN FOR DISPLAY
           ============================================= */

        const flattened = [];


        /* FAILED */

        errors.forEach(
            function (r) {

                flattened.push({

                    type: "FAILED",

                    NE_NAME: r[0],

                    "MML Command": r[1],

                    Message: r[2]

                });
            }
        );


        /* NO MATCH */

        noMatch.forEach(
            function (r) {

                flattened.push({

                    type: "NO_MATCH",

                    NE_NAME: r[0],

                    "MML Command": r[1],

                    Message: r[2]

                });
            }
        );


        /* SUCCESS */

        opSuccess.forEach(
            function (r) {

                flattened.push({

                    type: "SUCCESS",

                    NE_NAME: r[0],

                    "MML Command": r[1],

                    Message: r[2]

                });
            }
        );


        /* DATA */

        Object.keys(tables)
            .forEach(
                function (name) {

                    tables[name]
                        .rows
                        .forEach(
                            function (row) {

                                flattened.push({

                                    type: "DATA",

                                    table: name,

                                    ...row

                                });
                            }
                        );
                }
            );


        return flattened;
    }


    /* =====================================================
       DISPLAY OBJECT
       ===================================================== */

    function getDisplayObject(item) {

        if (

            item.type === "FAILED" ||

            item.type === "NO_MATCH" ||

            item.type === "SUCCESS"

        ) {

            return "";
        }


        const preferredKeys = [

            "NR Cell ID",

            "NR DU Cell TRP ID",

            "NR DU Cell ID",

            "Cell ID",

            "Cell Name",

            "Object ID",

            "Object Name"

        ];


        for (
            const key
            of preferredKeys
        ) {

            if (

                item[key] !== undefined &&

                item[key] !== ""

            ) {

                return text(
                    item[key]
                );
            }
        }


        for (
            const key
            of Object.keys(item)
        ) {

            const upper =
                key.toUpperCase();


            if (

                upper.includes("OBJ") ||

                upper.includes("CELL") ||

                upper.includes("TRP")

            ) {

                if (

                    item[key] !== undefined &&

                    item[key] !== ""

                ) {

                    return text(
                        item[key]
                    );
                }
            }
        }


        return "";
    }


    /* =====================================================
       DISPLAY RAW / MESSAGE
       ===================================================== */

    function getDisplayRaw(item) {

        if (
            item.Message !== undefined
        ) {

            return text(
                item.Message
            );
        }


        return "";
    }
        /* =====================================================
       PAGINATION ELEMENT
       ===================================================== */

    let paginationContainer = null;


    function createPagination() {

        if (paginationContainer) {
            return;
        }


        paginationContainer =
            document.createElement("div");

        paginationContainer.id =
            "mml-pagination";


        paginationContainer.innerHTML = `

            <div class="mml-pagination-top">

                <div id="mml-page-info">
                    No data
                </div>

                <div class="mml-rows-control">

                    <label for="mml-rows-select">
                        Rows:
                    </label>

                    <select id="mml-rows-select">

                        <option value="10">
                            10
                        </option>

                        <option value="25" selected>
                            25
                        </option>

                        <option value="50">
                            50
                        </option>

                        <option value="100">
                            100
                        </option>

                    </select>

                </div>

            </div>


            <div class="mml-pagination-bottom">

                <button
                    type="button"
                    id="mml-prev-btn"
                    class="mml-page-btn"
                >
                    Previous
                </button>


                <div id="mml-page-buttons"></div>


                <button
                    type="button"
                    id="mml-next-btn"
                    class="mml-page-btn"
                >
                    Next
                </button>

            </div>

        `;


        /*
         * IMPORTANT:
         * Pagination diletakkan sebelum tombol export,
         * bukan di dalam parent table.
         */

        if (xlsxBtn) {

            xlsxBtn.parentNode.insertBefore(
                paginationContainer,
                xlsxBtn
            );

        }

        else {

            table.parentNode.appendChild(
                paginationContainer
            );
        }


        document
            .getElementById("mml-rows-select")
            .addEventListener(
                "change",
                function () {

                    rowsPerPage =
                        parseInt(
                            this.value,
                            10
                        );

                    currentPage = 1;

                    renderPage();
                }
            );


        document
            .getElementById("mml-prev-btn")
            .addEventListener(
                "click",
                function () {

                    if (
                        currentPage > 1
                    ) {

                        currentPage--;

                        renderPage();
                    }
                }
            );


        document
            .getElementById("mml-next-btn")
            .addEventListener(
                "click",
                function () {

                    const totalPages =
                        Math.ceil(
                            allResults.length /
                            rowsPerPage
                        );


                    if (
                        currentPage <
                        totalPages
                    ) {

                        currentPage++;

                        renderPage();
                    }
                }
            );
    }


    /* =====================================================
       PAGE NUMBER GENERATOR
       ===================================================== */

    function getPageNumbers(
        current,
        total
    ) {

        if (total <= 7) {

            return Array.from(
                {
                    length: total
                },
                function (_, i) {

                    return i + 1;
                }
            );
        }


        const pages = [];


        pages.push(1);


        if (current > 4) {

            pages.push("...");
        }


        const start =
            Math.max(
                2,
                current - 1
            );


        const end =
            Math.min(
                total - 1,
                current + 1
            );


        for (
            let i = start;
            i <= end;
            i++
        ) {

            pages.push(i);
        }


        if (
            current < total - 3
        ) {

            pages.push("...");
        }


        pages.push(total);


        return pages;
    }


    /* =====================================================
       RENDER PAGINATION
       ===================================================== */

    function renderPagination() {

        if (!paginationContainer) {
            return;
        }


        const totalRows =
            allResults.length;


        const totalPages =
            Math.max(
                1,
                Math.ceil(
                    totalRows /
                    rowsPerPage
                )
            );


        if (
            currentPage > totalPages
        ) {

            currentPage =
                totalPages;
        }


        const start =
            totalRows === 0
                ? 0
                : (
                    (currentPage - 1) *
                    rowsPerPage
                ) + 1;


        const end =
            Math.min(
                currentPage *
                rowsPerPage,
                totalRows
            );


        const pageInfo =
            document.getElementById(
                "mml-page-info"
            );


        pageInfo.textContent =
            totalRows === 0
                ? "No data"
                : `Showing ${start}-${end} of ${totalRows}`;


        const pageButtons =
            document.getElementById(
                "mml-page-buttons"
            );


        pageButtons.innerHTML = "";


        const pageNumbers =
            getPageNumbers(
                currentPage,
                totalPages
            );


        pageNumbers.forEach(
            function (page) {

                if (page === "...") {

                    const dots =
                        document.createElement(
                            "span"
                        );

                    dots.className =
                        "mml-page-dots";

                    dots.textContent =
                        "...";

                    pageButtons.appendChild(
                        dots
                    );

                    return;
                }


                const btn =
                    document.createElement(
                        "button"
                    );


                btn.type =
                    "button";


                btn.className =
                    "mml-page-btn";


                btn.textContent =
                    page;


                if (
                    page === currentPage
                ) {

                    btn.classList.add(
                        "active"
                    );
                }


                btn.addEventListener(
                    "click",
                    function () {

                        currentPage =
                            page;

                        renderPage();
                    }
                );


                pageButtons.appendChild(
                    btn
                );

            }
        );


        const prevBtn =
            document.getElementById(
                "mml-prev-btn"
            );


        const nextBtn =
            document.getElementById(
                "mml-next-btn"
            );


        prevBtn.disabled =
            currentPage <= 1;


        nextBtn.disabled =
            currentPage >= totalPages;
    }


    /* =====================================================
       RENDER TABLE
       ===================================================== */

    function renderPage() {

        tbody.innerHTML = "";


        const totalRows =
            allResults.length;


        const startIndex =
            (currentPage - 1) *
            rowsPerPage;


        const endIndex =
            Math.min(
                startIndex +
                rowsPerPage,
                totalRows
            );


        const pageData =
            allResults.slice(
                startIndex,
                endIndex
            );


        pageData.forEach(
            function (item, index) {

                const tr =
                    document.createElement(
                        "tr"
                    );


                const no =
                    startIndex +
                    index +
                    1;


                const neName =
                    text(
                        item.NE_NAME
                    );


                const mmlCommand =
                    text(
                        item["MML Command"]
                    );


                const object =
                    getDisplayObject(
                        item
                    );


                const raw =
                    getDisplayRaw(
                        item
                    );


                tr.innerHTML = `

                    <td>${escapeHTML(no)}</td>

                    <td>${escapeHTML(neName)}</td>

                    <td>${escapeHTML(mmlCommand)}</td>

                    <td>${escapeHTML(object)}</td>

                    <td>${escapeHTML(raw)}</td>

                `;


                tbody.appendChild(
                    tr
                );
            }
        );


        renderPagination();
    }


    /* =====================================================
       ESCAPE HTML
       ===================================================== */

    function escapeHTML(value) {

        return text(value)
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );
    }


    /* =====================================================
       XLSX LOADER
       
       Tidak perlu edit HTML.
       Kalau SheetJS belum ada, JS akan load otomatis.
       ===================================================== */

    function loadXLSX() {

        if (
            typeof window.XLSX !==
            "undefined"
        ) {

            return Promise.resolve();
        }


        return new Promise(
            function (resolve, reject) {

                const script =
                    document.createElement(
                        "script"
                    );


                script.src =
                    "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";


                script.onload =
                    function () {

                        resolve();
                    };


                script.onerror =
                    function () {

                        reject(
                            new Error(
                                "Failed to load SheetJS"
                            )
                        );
                    };


                document.head.appendChild(
                    script
                );
            }
        );
    }


    /* =====================================================
       CONVERT ARRAY OF OBJECTS TO XLSX ROWS
       ===================================================== */

    function buildSheetData(
        header,
        rows
    ) {

        const output = [];


        /* HEADER */

        output.push(
            header
        );


        /* ROWS */

        rows.forEach(
            function (row) {

                const values =
                    header.map(
                        function (key) {

                            return row[key] !==
                                undefined
                                ? row[key]
                                : "";
                        }
                    );


                output.push(
                    values
                );
            }
        );


        return output;
    }


    /* =====================================================
       ERROR SHEET
       ===================================================== */

    function buildErrorSheet() {

        const data = [

            [
                "NE_NAME",
                "MML Command",
                "MESSAGE"
            ]

        ];


        errors.forEach(
            function (row) {

                data.push([

                    row[0],

                    row[1],

                    row[2]

                ]);
            }
        );


        return data;
    }


    /* =====================================================
       NO MATCH SHEET
       ===================================================== */

    function buildNoMatchSheet() {

        const data = [

            [
                "NE_NAME",
                "MML Command",
                "MESSAGE"
            ]

        ];


        noMatch.forEach(
            function (row) {

                data.push([

                    row[0],

                    row[1],

                    row[2]

                ]);
            }
        );


        return data;
    }


    /* =====================================================
       SUCCESS SHEET
       ===================================================== */

    function buildSuccessSheet() {

        const data = [

            [
                "NE_NAME",
                "MML Command",
                "MESSAGE"
            ]

        ];


        opSuccess.forEach(
            function (row) {

                data.push([

                    row[0],

                    row[1],

                    row[2]

                ]);
            }
        );


        return data;
    }


    /* =====================================================
       AUTO WIDTH
       ===================================================== */

    function autoWidth(
        worksheet
    ) {

        const range =
            XLSX.utils.decode_range(
                worksheet["!ref"]
            );


        const widths = [];


        for (
            let col =
                range.s.c;
            col <= range.e.c;
            col++
        ) {

            let maxLength = 10;


            for (
                let row =
                    range.s.r;
                row <= range.e.r;
                row++
            ) {

                const cell =
                    worksheet[
                        XLSX.utils.encode_cell({
                            r: row,
                            c: col
                        })
                    ];


                if (
                    !cell ||
                    cell.v === undefined ||
                    cell.v === null
                ) {
                    continue;
                }


                const length =
                    String(cell.v)
                        .length;


                if (
                    length >
                    maxLength
                ) {

                    maxLength =
                        length;
                }
            }


            widths.push({

                wch:
                    Math.min(
                        maxLength + 2,
                        50
                    )

            });
        }


        worksheet["!cols"] =
            widths;
    }


    /* =====================================================
       STYLE SHEET
       ===================================================== */

    function prepareWorksheet(
        worksheet
    ) {

        worksheet["!freeze"] = {

            xSplit: 0,

            ySplit: 1

        };


        if (
            worksheet["!ref"]
        ) {

            worksheet["!autofilter"] = {

                ref:
                    worksheet["!ref"]

            };
        }


        autoWidth(
            worksheet
        );
    }


    /* =====================================================
       EXPORT XLSX
       ===================================================== */

    async function downloadXLSX() {

        if (
            allResults.length === 0
        ) {

            alert(
                "Please parse an MML file first."
            );

            return;
        }


        try {

            await loadXLSX();

        }

        catch (error) {

            console.error(
                error
            );


            alert(
                "SheetJS failed to load. Please check your internet connection."
            );

            return;
        }


        const workbook =
            XLSX.utils.book_new();


        /* ==============================================
           FAILED
           ============================================== */

        let worksheet =
            XLSX.utils.aoa_to_sheet(
                buildErrorSheet()
            );


        prepareWorksheet(
            worksheet
        );


        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "FAILED"
        );


        /* ==============================================
           NO MATCH
           ============================================== */

        worksheet =
            XLSX.utils.aoa_to_sheet(
                buildNoMatchSheet()
            );


        prepareWorksheet(
            worksheet
        );


        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "NO_MATCH"
        );


        /* ==============================================
           LOG SUCCESS
           ============================================== */

        worksheet =
            XLSX.utils.aoa_to_sheet(
                buildSuccessSheet()
            );


        prepareWorksheet(
            worksheet
        );


        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            "LOG_SUCCESS"
        );


        /* ==============================================
           COMMAND TABLES
           ============================================== */

        Object.keys(tables)
            .forEach(
                function (tableName) {

                    const tableData =
                        tables[tableName];


                    const sheetData =
                        buildSheetData(
                            tableData.header,
                            tableData.rows
                        );


                    const ws =
                        XLSX.utils.aoa_to_sheet(
                            sheetData
                        );


                    prepareWorksheet(
                        ws
                    );


                    XLSX.utils.book_append_sheet(
                        workbook,
                        ws,
                        tableName
                    );

                }
            );


        /* ==============================================
           FILE NAME
           ============================================== */

        let outputName =
            "MML_Task_Result_parsed.xlsx";


        if (
            fileInput.files &&
            fileInput.files.length > 0
        ) {

            const originalName =
                fileInput.files[0].name;


            outputName =
                originalName
                    .replace(
                        /\.[^/.]+$/,
                        ""
                    ) +
                "_parsed.xlsx";
        }


        /* ==============================================
           DOWNLOAD
           ============================================== */

        XLSX.writeFile(
            workbook,
            outputName
        );
    }


    /* =====================================================
       STATUS
       ===================================================== */

    function updateStatus() {

        const total =
            allResults.length;


        const failed =
            errors.length;


        const unmatched =
            noMatch.length;


        const success =
            opSuccess.length;


        let commandRows = 0;


        Object.keys(tables)
            .forEach(
                function (name) {

                    commandRows +=
                        tables[name]
                            .rows
                            .length;
                }
            );


        if (status) {

            status.textContent =
                `Parsed ${total.toLocaleString()} rows ` +
                `| FAILED: ${failed.toLocaleString()} ` +
                `| NO_MATCH: ${unmatched.toLocaleString()} ` +
                `| SUCCESS: ${success.toLocaleString()} ` +
                `| DATA: ${commandRows.toLocaleString()}`;
        }
    }


    /* =====================================================
       FILE NAME DISPLAY
       ===================================================== */

    function updateFileName() {

        if (!fileName) {
            return;
        }


        if (
            fileInput.files &&
            fileInput.files.length > 0
        ) {

            fileName.textContent =
                fileInput.files[0].name;
        }

        else {

            fileName.textContent =
                "";
        }
    }


    /* =====================================================
       PARSE BUTTON
       ===================================================== */

    parseBtn.addEventListener(
        "click",
        function () {

            if (
                !fileInput.files ||
                fileInput.files.length === 0
            ) {

                alert(
                    "Please select an MML file first."
                );

                return;
            }


            const file =
                fileInput.files[0];


            const reader =
                new FileReader();


            reader.onload =
                function (event) {

                    try {

                        const sourceText =
                            event.target.result;


                        allResults =
                            parseMML(
                                sourceText
                            );


                        currentPage = 1;

                        rowsPerPage = 25;


                        createPagination();


                        renderPage();


                        updateStatus();


                        if (xlsxBtn) {

                            xlsxBtn.disabled =
                                allResults.length === 0;

                        }

                    }

                    catch (error) {

                        console.error(
                            error
                        );


                        alert(
                            "Failed to parse MML file."
                        );

                    }
                };


            reader.onerror =
                function () {

                    alert(
                        "Failed to read the selected file."
                    );
                };


            reader.readAsText(
                file
            );
        }
    );


    /* =====================================================
       RESET
       ===================================================== */

    resetBtn.addEventListener(
        "click",
        function () {

            allResults = [];

            tables = {};

            errors = [];

            noMatch = [];

            opSuccess = [];

            currentPage = 1;


            tbody.innerHTML = "";


            if (status) {

                status.textContent =
                    "";
            }


            if (fileInput) {

                fileInput.value =
                    "";
            }


            if (fileName) {

                fileName.textContent =
                    "";
            }


            if (xlsxBtn) {

                xlsxBtn.disabled =
                    true;
            }


            if (paginationContainer) {

                paginationContainer
                    .remove();

                paginationContainer =
                    null;
            }
        }
    );


    /* =====================================================
       FILE INPUT
       ===================================================== */

    fileInput.addEventListener(
        "change",
        function () {

            updateFileName();
        }
    );


    /* =====================================================
       EXPORT BUTTON
       
       Compatible dengan:
       #xlsx-btn
       atau HTML lama:
       #csv-btn
       ===================================================== */

    let exportButton =
        document.getElementById(
            "xlsx-btn"
        );


    if (!exportButton) {

        exportButton =
            document.getElementById(
                "csv-btn"
            );
    }


    if (exportButton) {

        exportButton.textContent =
            "Download XLSX";


        exportButton.disabled =
            true;


        exportButton.addEventListener(
            "click",
            downloadXLSX
        );
    }


    /* =====================================================
       INITIAL STATE
       ===================================================== */

    if (status) {

        status.textContent =
            "Ready";
    }

})();
