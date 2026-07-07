#!/usr/bin/env python3
import fdb

DB = r"C:\Users\BharatS\Documents\Customer Portal\UBNZ.FDB"
OBL = "SZTAU26080467"
CONSOL = 9846


def connect():
    return fdb.connect(dsn=f"localhost:{DB}", user="SYSDBA", password="masterkey", charset="WIN1252")


def main():
    con = connect()
    cur = con.cursor()

    print("=== Search OBL across sea modules ===")
    for st, obl_col, jt in [
        ("FIS_SHIPMENT", "OCEAN_BILL", "FIS_JOB"),
        ("FES_SHIPMENT", "OBILL", "FES_JOB"),
    ]:
        cur.execute(
            f'SELECT s."SHIPMENT", TRIM(s."{obl_col}"), COUNT(j."JOB_UNIQUE") '
            f'FROM "{st}" s LEFT JOIN "{jt}" j ON j."COMPANY"=s."COMPANY" AND j."BRANCH"=s."BRANCH" AND j."SHIPMENT"=s."SHIPMENT" '
            f'WHERE TRIM(s."{obl_col}")=? GROUP BY s."SHIPMENT", TRIM(s."{obl_col}")',
            [OBL],
        )
        print(st, cur.fetchall())

    print("\n=== FIS consol 9846 ===")
    cur.execute(
        'SELECT s."SHIPMENT", TRIM(s."OCEAN_BILL"), COUNT(j."JOB_UNIQUE") '
        'FROM "FIS_SHIPMENT" s LEFT JOIN "FIS_JOB" j ON j."COMPANY"=s."COMPANY" AND j."BRANCH"=s."BRANCH" AND j."SHIPMENT"=s."SHIPMENT" '
        'WHERE s."SHIPMENT"=? GROUP BY s."SHIPMENT", TRIM(s."OCEAN_BILL")',
        [CONSOL],
    )
    print(cur.fetchall())
    cur.execute(
        'SELECT FIRST 10 j."JOB_UNIQUE", j."JOB", TRIM(j."HOUSEBILL") FROM "FIS_JOB" j WHERE j."SHIPMENT"=? ORDER BY j."JOB"',
        [CONSOL],
    )
    print("FIS jobs on consol:", cur.fetchall())

    print("\n=== Search JOB_UNIQUE near 177964 in FIS ===")
    cur.execute('SELECT "JOB_UNIQUE","JOB","SHIPMENT" FROM "FIS_JOB" WHERE "JOB_UNIQUE" BETWEEN 177950 AND 177980')
    print(cur.fetchall())
    cur.execute('SELECT "JOB_UNIQUE","JOB","SHIPMENT" FROM "FIS_JOB" WHERE "JOB"=177964')
    print("JOB number 177964:", cur.fetchall())

    print("\n=== FRT_REFERENCE FLAG breakdown ===")
    cur.execute('SELECT TRIM("FLAG"), COUNT(*) FROM "FRT_REFERENCE" GROUP BY TRIM("FLAG")')
    print(cur.fetchall())
    cur.execute('SELECT FIRST 5 TRIM("FLAG"), TRIM("REFERENCE"), "JOB", "DEPARTMENT" FROM "FRT_REFERENCE" WHERE TRIM("FLAG")=\'O\'')
    print("FLAG=O samples:", cur.fetchall())
    cur.execute('SELECT FIRST 5 TRIM("FLAG"), TRIM("REFERENCE"), "JOB", "DEPARTMENT" FROM "FRT_REFERENCE" WHERE "FLAG" IS NULL')
    print("FLAG=NULL samples:", cur.fetchall())

    print("\n=== FRT_REFERENCE join FIS by JOB number on consol 9846 jobs ===")
    cur.execute('SELECT j."JOB_UNIQUE", j."JOB", r."REFERENCE", TRIM(r."FLAG") FROM "FIS_JOB" j JOIN "FRT_REFERENCE" r ON r."JOB"=j."JOB" WHERE j."SHIPMENT"=?', [CONSOL])
    rows = cur.fetchall()
    print(f"rows: {len(rows)}")
    for r in rows[:10]:
        print(r)

    print("\n=== FRT_REFERENCE join FIS by JOB_UNIQUE? ===")
    cur.execute(
        "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME='FRT_REFERENCE'"
    )
    cols = [r[0] for r in cur.fetchall()]
    print("cols:", cols)
    # Maybe DEPARTMENT holds module code?
    cur.execute('SELECT TRIM("DEPARTMENT"), COUNT(*) FROM "FRT_REFERENCE" WHERE "DEPARTMENT" IS NOT NULL GROUP BY TRIM("DEPARTMENT")')
    print("DEPARTMENT non-null:", cur.fetchall())

    print("\n=== Search tables with JOB_UNIQUE for FIS consol 9846 ===")
    cur.execute(
        "SELECT TRIM(RDB$RELATION_NAME) FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG=0 AND RDB$VIEW_BLR IS NULL"
    )
    all_tables = [r[0] for r in cur.fetchall()]
    fis_jobs = []
    cur.execute('SELECT "JOB_UNIQUE","JOB" FROM "FIS_JOB" WHERE "SHIPMENT"=?', [CONSOL])
    fis_jobs = cur.fetchall()
    if not fis_jobs:
        print("No FIS jobs on consol 9846")
    else:
        ju_list = [x[0] for x in fis_jobs]
        print(f"FIS jobs on consol: {fis_jobs[:5]}... total {len(fis_jobs)}")
        for t in all_tables:
            cur.execute(
                "SELECT COUNT(*) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME=? AND TRIM(RDB$FIELD_NAME)='JOB_UNIQUE'",
                [t],
            )
            if cur.fetchone()[0] == 0:
                continue
            try:
                cur.execute(f'SELECT COUNT(*) FROM "{t}" WHERE "JOB_UNIQUE" IN ({",".join("?"*len(ju_list[:3]))})', ju_list[:3])
                n = cur.fetchone()[0]
                if n:
                    tcols = []
                    cur.execute(
                        "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME=? ORDER BY RDB$FIELD_POSITION",
                        [t],
                    )
                    tcols = [r[0] for r in cur.fetchall()]
                    print(f"  {t}: {n} rows (sample ju) cols={tcols[:15]}")
                    cur.execute(f'SELECT FIRST 2 * FROM "{t}" WHERE "JOB_UNIQUE"=?', [ju_list[0]])
                    dcols = [d[0].strip() for d in cur.description]
                    for row in cur.fetchall():
                        print("    ", dict(zip(dcols, row)))
            except Exception:
                pass

    cur.close()
    con.close()


if __name__ == "__main__":
    main()
