// ==========================================
// MML PARSER - WEB VERSION
// ==========================================
// Client-side parser based on mml_organizerv6.py
// Includes basic casual source/copy protection.
// ==========================================


// ==========================================
// BASIC SOURCE / COPY PROTECTION
// ==========================================

document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
});

document.addEventListener("dragstart", function (e) {
    // Allow file input interaction
    if (e.target.tagName === "INPUT") return;

    e.preventDefault();
});

document.addEventListener("keydown", function (e) {

    const key = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;

    // F12
    if (e.key === "F12") {
        e.preventDefault();
        return false;
    }

    if (ctrl) {

        // Copy
        if (key === "c") {
            e.preventDefault();
            return false;
        }

        // Cut
        if (key === "x") {
            e.preventDefault();
            return false;
        }

        // Save page
        if (key === "s") {
            e.preventDefault();
            return false;
        }

        // View source
        if (key === "u") {
            e.preventDefault();
            return false;
        }

        // Print
        if (key === "p") {
            e.preventDefault();
            return false;
        }

        // Developer tools
        if (
            e.shiftKey &&
            (
                key === "i" ||
                key === "j" ||
                key === "c"
            )
        ) {
            e.preventDefault();
            return false;
        }
    }
});


// Disable casual text selection,
// but keep INPUT / TEXTAREA usable.
const protectionStyle =
    document.createElement("style");

protectionStyle.textContent = `
    body {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        user-select: none !important;
    }

    input,
    textarea,
    select {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        user-select: text !important;
    }

    img {
        -webkit-user-drag: none !important;
        user-drag: none !important;
    }
`;

document.head.appendChild(protectionStyle);


// ==========================================
// MML PARSER
// ==========================================

(() => {

    const fileInput =
        document.getElementById("mml-file");

    const parseBtn =
        document.getElementById("parse-btn");

    const resetBtn =
        document.getElementById("reset-btn");

    const csvBtn =
        document.getElementById("csv-btn");

    const fileName =
        document.getElementById("file-name");

    const status =
        document.getElementById("mml-status");

    const tbody =
        document.querySelector(
            "#result-table tbody"
        );


    let parsedRows = [];

    let lastFileBase = "mml";


    // ======================================
    // FAILED PATTERNS
    // ======================================

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


    // ======================================
    // DETECT NE NAME
    // ======================================

    function detectNE(line, current) {

        // +++ NE_NAME 2026-09-01 ...
        if (line.includes("+++")) {

            const match =
                line.match(
                    /\+{3}\s+(.+?)\s+\d{4}-\d{2}-\d{2}/
                );

            if (match) {

                return match[1].trim();

            }
        }


        // NE : NE_NAME
        else if (
            line.startsWith("NE :")
        ) {

            return line
                .replace("NE :", "")
                .trim();

        }


        // NE_NAME#
        else if (
            line.includes("#") &&
            !line.includes("+++") &&
            !/^(%%|O&M|---)/.test(line)
        ) {

            return line.trim();

        }


        return current;
    }


    // ======================================
    // DETECT COMMAND
    // ======================================

    function detectCommand(line, current) {

        const match =
            line.match(
                /\b(MOD|ADD|RMV|SET|LST|DSP)\s+([A-Z0-9_]+)/
            );

        if (match) {

            return `${match[1]} ${match[2]}`;

        }

        return current;
    }


    // ======================================
    // PARSE KEY = VALUE
    // ======================================

    function parseKVBlock(
        block,
        neName,
        command
    ) {

        const row = {

            "NE_NAME": neName,

            "MML Command": command

        };


        for (
            const line of block
        ) {

            const match =
                line.match(
                    /(.+?)\s*=\s*(.+)/
                );


            if (!match) {

                continue;

            }


            const key =
                match[1].trim();

            const value =
                match[2].trim();


            // Example:
            // A=1&B=2&C=3

            if (
                value.includes("&") &&
                value.includes(":")
            ) {

                for (
                    const sub
                    of value.split("&")
                ) {

                    if (
                        sub.includes(":")
                    ) {

                        const [
                            subKey,
                            ...rest
                        ] = sub.split(":");


                        row[
                            subKey.trim()
                        ] =
                            rest
                                .join(":")
                                .trim();
                    }
                }

            }

            else {

                row[key] = value;

            }
        }


        return row;
    }


    // ======================================
    // PARSE TABLE
    // ======================================

    function parseTableBlock(
        block,
        neName,
        command
    ) {

        const header =
            block[0]
                .split(/\s{2,}/)
                .map(
                    x => x.trim()
                )
                .filter(Boolean);


        const rows = [];


        for (
            const line
            of block.slice(1)
        ) {

            const columns =
                line
                    .split(/\s{2,}/)
                    .map(
                        x => x.trim()
                    );


            const row = {

                "NE_NAME": neName,

                "MML Command": command

            };


            header.forEach(
                (headerName, index) => {

                    const value =
                        columns[index] ?? "";


                    // Example:
                    // PARAM1:ABC&PARAM2:123

                    if (
                        value.includes("&") &&
                        value.includes(":")
                    ) {

                        for (
                            const sub
                            of value.split("&")
                        ) {

                            if (
                                sub.includes(":")
                            ) {

                                const [
                                    subKey,
                                    ...rest
                                ] = sub.split(":");


                                row[
                                    subKey.trim()
                                ] =
                                    rest
                                        .join(":")
                                        .trim();
                            }
                        }

                    }

                    else {

                        row[
                            headerName
                        ] = value;

                    }
                }
            );


            rows.push(row);
        }


        return rows;
    }


    // ======================================
    // MAIN PARSER
    // ======================================

    function parseMML(text) {

        const lines =
            text.split(/\r?\n/);


        let neName = "";

        let command = "";


        const result = {

            errors: [],

            noMatch: [],

            success: [],

            tables: {}

        };


        for (
            let i = 0;
            i < lines.length;
            i++
        ) {

            const line =
                lines[i].trim();


            // ------------------------------
            // NE NAME
            // ------------------------------

            neName =
                detectNE(
                    line,
                    neName
                );


            // ------------------------------
            // COMMAND
            // ------------------------------

            command =
                detectCommand(
                    line,
                    command
                );


            // ------------------------------
            // FAILED
            // ------------------------------

            for (
                const pattern
                of failedPatterns
            ) {

                if (
                    line.includes(pattern)
                ) {

                    result.errors.push([

                        neName,

                        command,

                        line

                    ]);

                    break;
                }
            }


            // ------------------------------
            // NO MATCH
            // ------------------------------

            if (
                line.includes(
                    "No matching result"
                )
            ) {

                result.noMatch.push([

                    neName,

                    command,

                    line

                ]);
            }


            // ------------------------------
            // SUCCESS
            // ------------------------------

            if (
                line.includes(
                    "Operation succeeded"
                )
            ) {

                result.success.push([

                    neName,

                    command,

                    line

                ]);
            }


            // ------------------------------
            // TABLE START
            // ------------------------------

            if (
                line.startsWith(
                    "------------"
                )
            ) {

                const block = [];


                i++;


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


                    if (
                        row !== ""
                    ) {

                        block.push(row);

                    }


                    i++;
                }


                if (
                    block.length === 0
                ) {

                    continue;

                }


                // --------------------------
                // TABLE NAME
                // --------------------------

                let tableName = (

                    command ||
                    "UNKNOWN"

                )
                    .replace(
                        /\W+/g,
                        "_"
                    )
                    .slice(0, 31);


                if (
                    !tableName
                ) {

                    tableName =
                        "UNKNOWN";

                }


                if (
                    !result.tables[
                        tableName
                    ]
                ) {

                    result.tables[
                        tableName
                    ] = {

                        header: [

                            "NE_NAME",

                            "MML Command"

                        ],

                        rows: []

                    };
                }


                // --------------------------
                // KEY = VALUE FORMAT
                // --------------------------

                if (
                    block[0].includes("=")
                ) {

                    const row =
                        parseKVBlock(
                            block,
                            neName,
                            command
                        );


                    Object.keys(row)
                        .forEach(key => {

                            if (
                                !result
                                    .tables[
                                        tableName
                                    ]
                                    .header
                                    .includes(key)
                            ) {

                                result
                                    .tables[
                                        tableName
                                    ]
                                    .header
                                    .push(key);
                            }

                        });


                    result
                        .tables[
                            tableName
                        ]
                        .rows
                        .push(row);

                }


                // --------------------------
                // NORMAL TABLE
                // --------------------------

                else {

                    const rows =
                        parseTableBlock(
                            block,
                            neName,
                            command
                        );


                    rows.forEach(
                        row => {

                            Object.keys(row)
                                .forEach(key => {

                                    if (
                                        !result
                                            .tables[
                                                tableName
                                            ]
                                            .header
                                            .includes(key)
                                    ) {

                                        result
                                            .tables[
                                                tableName
                                            ]
                                            .header
                                            .push(key);
                                    }

                                });


                            result
                                .tables[
                                    tableName
                                ]
                                .rows
                                .push(row);

                        }
                    );
                }
            }
        }


        return result;
    }


    // ======================================
    // ESCAPE HTML
    // ======================================

    function escapeHTML(value) {

        return String(
            value ?? ""
        )

            .replaceAll(
                "&",
                "&amp;"
            )

            .replaceAll(
                "<",
                "&lt;"
            )

            .replaceAll(
                ">",
                "&gt;"
            )

            .replaceAll(
                '"',
                "&quot;"
            )

            .replaceAll(
                "'",
                "&#039;"
            );
    }


    // ======================================
    // FLATTEN RESULT
    // ======================================

    function flatten(result) {

        const rows = [];


        // FAILED
        result.errors.forEach(
            row => {

                rows.push({

                    type: "FAILED",

                    ne: row[0],

                    command: row[1],

                    object: "",

                    raw: row[2]

                });

            }
        );


        // NO MATCH
        result.noMatch.forEach(
            row => {

                rows.push({

                    type: "NO_MATCH",

                    ne: row[0],

                    command: row[1],

                    object: "",

                    raw: row[2]

                });

            }
        );


        // SUCCESS
        result.success.forEach(
            row => {

                rows.push({

                    type: "SUCCESS",

                    ne: row[0],

                    command: row[1],

                    object: "",

                    raw: row[2]

                });

            }
        );


        // TABLE
        Object.values(
            result.tables
        ).forEach(
            table => {

                table.rows.forEach(
                    row => {

                        const object =

                            row.OBJECT ??

                            row.Object ??

                            row.object ??

                            row.CELLNAME ??

                            row.CellName ??

                            row.CELL_NAME ??

                            "";


                        const raw =

                            Object.entries(row)

                                .filter(
                                    ([key]) =>

                                        key !== "NE_NAME" &&

                                        key !== "MML Command"
                                )

                                .map(
                                    ([key, value]) =>

                                        `${key}=${value}`
                                )

                                .join(" | ");


                        rows.push({

                            type: "TABLE",

                            ne:
                                row[
                                    "NE_NAME"
                                ] ?? "",

                            command:
                                row[
                                    "MML Command"
                                ] ?? "",

                            object,

                            raw

                        });

                    }
                );

            }
        );


        return rows;
    }


    // ======================================
    // RENDER RESULT
    // ======================================

    function render(result) {

        parsedRows =
            flatten(result);


        if (
            parsedRows.length === 0
        ) {

            tbody.innerHTML = `

                <tr>

                    <td
                        colspan="5"
                        class="empty"
                    >
                        No parsed result found.
                    </td>

                </tr>

            `;


            csvBtn.disabled = true;


            return;
        }


        tbody.innerHTML =

            parsedRows

                .map(
                    (row, index) => `

                    <tr>

                        <td>
                            ${index + 1}
                        </td>

                        <td>
                            ${escapeHTML(
                                row.ne
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                row.command
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                row.object
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                row.raw
                            )}
                        </td>

                    </tr>

                `
                )

                .join("");


        csvBtn.disabled = false;


        status.innerHTML =

            `Parsed <b>${parsedRows.length}</b> records · ` +

            `Success: <b>${result.success.length}</b> · ` +

            `Failed: <b>${result.errors.length}</b> · ` +

            `No Match: <b>${result.noMatch.length}</b> · ` +

            `Tables: <b>${Object.keys(
                result.tables
            ).length}</b>`;
    }


    // ======================================
    // CSV ESCAPE
    // ======================================

    function csvEscape(value) {

        const text =
            String(value ?? "");


        return `"${text.replaceAll(
            '"',
            '""'
        )}"`;
    }


    // ======================================
    // DOWNLOAD CSV
    // ======================================

    function downloadCSV() {

        if (
            parsedRows.length === 0
        ) {

            return;

        }


        const header = [

            "No",

            "NE_NAME",

            "COMMAND",

            "OBJECT",

            "RAW"

        ];


        const lines = [

            header
                .map(csvEscape)
                .join(","),


            ...parsedRows.map(
                (row, index) => {

                    return [

                        index + 1,

                        row.ne,

                        row.command,

                        row.object,

                        row.raw

                    ]

                        .map(csvEscape)

                        .join(",");

                }
            )

        ];


        const blob =
            new Blob(

                [

                    "\uFEFF" +

                    lines.join(
                        "\r\n"
                    )

                ],

                {

                    type:
                        "text/csv;charset=utf-8;"

                }

            );


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href = url;


        link.download =
            `${lastFileBase}_parsed.csv`;


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        URL.revokeObjectURL(
            url
        );
    }


    // ======================================
    // FILE SELECT
    // ======================================

    fileInput.addEventListener(
        "change",
        () => {

            const file =
                fileInput.files?.[0];


            if (!file) {

                fileName.textContent =
                    "Choose MML TXT or LOG file";

                return;

            }


            fileName.textContent =
                file.name;


            lastFileBase =
                file.name.replace(
                    /\.[^.]+$/,
                    ""
                );


            status.textContent =
                "File ready. Click Parse MML.";

        }
    );


    // ======================================
    // PARSE BUTTON
    // ======================================

    parseBtn.addEventListener(
        "click",
        async () => {

            const file =
                fileInput.files?.[0];


            if (!file) {

                status.textContent =
                    "Please choose a TXT or LOG file first.";

                return;

            }


            status.textContent =
                "Parsing dump...";


            try {

                const text =
                    await file.text();


                const result =
                    parseMML(text);


                render(result);

            }

            catch (error) {

                console.error(error);


                status.textContent =
                    `Parsing failed: ${error.message}`;


                csvBtn.disabled = true;

            }

        }
    );


    // ======================================
    // RESET
    // ======================================

    resetBtn.addEventListener(
        "click",
        () => {

            fileInput.value = "";


            fileName.textContent =
                "Choose MML TXT or LOG file";


            status.textContent = "";


            parsedRows = [];


            tbody.innerHTML = `

                <tr>

                    <td
                        colspan="5"
                        class="empty"
                    >
                        Upload a TXT file to see the result.
                    </td>

                </tr>

            `;


            csvBtn.disabled = true;


            lastFileBase = "mml";

        }
    );


    // ======================================
    // CSV BUTTON
    // ======================================

    csvBtn.addEventListener(
        "click",
        downloadCSV
    );

})();