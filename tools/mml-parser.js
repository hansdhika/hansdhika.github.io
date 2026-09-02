function parseMML(text) {

    const lines = text.split(/\r?\n/);

    let neName = "";
    let command = "";

    const results = [];

    // Sama dengan Python:
    // tables = {}
    const tables = {};

    const errors = [];
    const noMatch = [];
    const opSuccess = [];

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


    let i = 0;

    while (i < lines.length) {

        const line = lines[i].trim();


        /* =================================================
           FIX NE NAME
           Sama dengan Python
           ================================================= */

        if (line.includes("+++")) {

            const m = line.match(
                /\+{3}\s+(.+?)\s+\d{4}-\d{2}-\d{2}/
            );

            if (m) {
                neName = m[1].trim();
            }

        }

        else if (line.startsWith("NE :")) {

            neName =
                line.replace("NE :", "").trim();

        }

        else if (
            line.includes("#") &&
            !line.includes("+++") &&
            !line.startsWith("%%") &&
            !line.startsWith("O&M") &&
            !line.startsWith("---")
        ) {

            neName = line.trim();
        }


        /* =================================================
           COMMAND DETECTION
           Sama dengan Python
           ================================================= */

        const commandMatch = line.match(
            /(MOD|ADD|RMV|SET|LST|DSP)\s+([A-Z0-9_]+)/
        );

        if (commandMatch) {

            command =
                `${commandMatch[1]} ${commandMatch[2]}`;
        }


        /* =================================================
           ERROR DETECTION
           ================================================= */

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


        /* =================================================
           NO MATCH
           ================================================= */

        if (line.includes("No matching result")) {

            noMatch.push([
                neName,
                command,
                line
            ]);
        }


        /* =================================================
           OPERATION SUCCESS
           ================================================= */

        if (line.includes("Operation succeeded")) {

            opSuccess.push([
                neName,
                command,
                line
            ]);
        }


        /* =================================================
           TABLE PARSING
           ================================================= */

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


            if (block.length > 0) {

                /*
                 * Python:
                 * table_name = re.sub(r'\W+', "_", command)[:31]
                 */

                const tableName =
                    command
                        .replace(/[^\w]+/g, "_")
                        .substring(0, 31);


                if (!tables[tableName]) {

                    tables[tableName] = {

                        header: [
                            "NE_NAME",
                            "MML Command"
                        ],

                        rows: []
                    };
                }


                /* =================================================
                   FORMAT KEY = VALUE
                   ================================================= */

                if (block[0].includes("=")) {

                    const rowDict = {

                        "NE_NAME": neName,
                        "MML Command": command
                    };


                    for (const r of block) {

                        /*
                         * Python:
                         * re.match(r"(.+?)\s*=\s*(.+)", r)
                         */

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


                        /* =========================================
                           SUB PARAMETERS
                           Python:
                           if "&" in v and ":" in v
                           ========================================= */

                        if (
                            v.includes("&") &&
                            v.includes(":")
                        ) {

                            const subParams =
                                v.split("&");


                            for (const sub of subParams) {

                                if (!sub.includes(":")) {
                                    continue;
                                }


                                const separator =
                                    sub.indexOf(":");


                                const sk =
                                    sub
                                        .substring(0, separator)
                                        .trim();


                                const sv =
                                    sub
                                        .substring(separator + 1)
                                        .trim();


                                rowDict[sk] = sv;
                            }

                        }

                        else {

                            rowDict[k] = v;
                        }
                    }


                    /* =========================================
                       ADD NEW HEADERS
                       Sama persis konsep Python
                       ========================================= */

                    for (const k of Object.keys(rowDict)) {

                        if (
                            !tables[tableName]
                                .header
                                .includes(k)
                        ) {

                            tables[tableName]
                                .header
                                .push(k);
                        }
                    }


                    tables[tableName]
                        .rows
                        .push(rowDict);
                }


                /* =================================================
                   FORMAT TABLE
                   ================================================= */

                else {

                    /*
                     * Python:
                     * header_line = re.split(r"\s{2,}", block[0])
                     */

                    const headerLine =
                        block[0]
                            .split(/\s{2,}/);


                    for (
                        let r = 1;
                        r < block.length;
                        r++
                    ) {

                        const row =
                            block[r];


                        /*
                         * Python:
                         * cols = re.split(r"\s{2,}", r)
                         */

                        const cols =
                            row.split(/\s{2,}/);


                        const rowDict = {

                            "NE_NAME": neName,
                            "MML Command": command
                        };


                        /*
                         * Python:
                         * for h, v in zip(header_line, cols)
                         */

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
                                headerLine[c].trim();

                            const v =
                                cols[c].trim();


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


                                    rowDict[sk] = sv;
                                }

                            }

                            else {

                                rowDict[h] = v;
                            }
                        }


                        /*
                         * Add dynamic headers
                         */

                        for (
                            const k
                            of Object.keys(rowDict)
                        ) {

                            if (
                                !tables[tableName]
                                    .header
                                    .includes(k)
                            ) {

                                tables[tableName]
                                    .header
                                    .push(k);
                            }
                        }


                        tables[tableName]
                            .rows
                            .push(rowDict);
                    }
                }
            }
        }


        i++;
    }


    /* =================================================
       FLATTEN RESULT

       Kita tetap gunakan 1 array untuk pagination,
       tetapi SEKARANG setiap row membawa seluruh
       hasil parsing Python.
       ================================================= */

    const flattened = [];


    /* =================================================
       FAILED
       ================================================= */

    for (const r of errors) {

        flattened.push({

            type: "FAILED",

            NE_NAME: r[0],

            "MML Command": r[1],

            Message: r[2]
        });
    }


    /* =================================================
       NO MATCH
       ================================================= */

    for (const r of noMatch) {

        flattened.push({

            type: "NO_MATCH",

            NE_NAME: r[0],

            "MML Command": r[1],

            Message: r[2]
        });
    }


    /* =================================================
       SUCCESS
       ================================================= */

    for (const r of opSuccess) {

        flattened.push({

            type: "SUCCESS",

            NE_NAME: r[0],

            "MML Command": r[1],

            Message: r[2]
        });
    }


    /* =================================================
       DATA TABLES
       ================================================= */

    for (
        const tableName
        of Object.keys(tables)
    ) {

        const table =
            tables[tableName];


        for (
            const row
            of table.rows
        ) {

            flattened.push({

                type: "DATA",

                table: tableName,

                ...row
            });
        }
    }


    return flattened;
}
