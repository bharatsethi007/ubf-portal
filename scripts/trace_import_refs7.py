#!/usr/bin/env python3
import fdb

DB = r"C:\Users\BharatS\Documents\Customer Portal\UBNZ.FDB"


def connect():
    return fdb.connect(dsn=f"localhost:{DB}", user="SYSDBA", password="masterkey", charset="WIN1252")


def main():
    con = connect()
    cur = con.cursor()

    print("=== FIS snapshot bounds ===")
    cur.execute('SELECT MAX("JOB_UNIQUE"), MAX("JOB"), MAX("SHIPMENT") FROM "FIS_JOB"')
    print("max:", cur.fetchone())
    cur.execute('SELECT MAX("MODIFIED") FROM "FIS_JOB"')
    print("latest modified:", cur.fetchone()[0])

    print("\n=== Search anchor variants ===")
    for q, p in [
        ('SELECT "JOB_UNIQUE","JOB","SHIPMENT" FROM "FIS_JOB" WHERE "JOB"=?', [177964]),
        ('SELECT "JOB_UNIQUE","JOB","SHIPMENT" FROM "FIS_JOB" WHERE "JOB_UNIQUE"=?', [177964]),
        ('SELECT s."SHIPMENT", TRIM(s."OCEAN_BILL") FROM "FIS_SHIPMENT" s WHERE s."SHIPMENT"=?', [9846]),
        ('SELECT s."SHIPMENT", TRIM(s."OCEAN_BILL") FROM "FIS_SHIPMENT" s WHERE TRIM(s."OCEAN_BILL") CONTAINING ?', ['SZTAU']),
        ('SELECT s."SHIPMENT", TRIM(s."OCEAN_BILL") FROM "FIS_SHIPMENT" s WHERE TRIM(s."OCEAN_BILL")=?', ['SZTAU26080467']),
    ]:
        try:
            cur.execute(q, p)
            rows = cur.fetchall()
            if rows:
                print(q[:60], "->", rows[:5])
        except Exception as e:
            print("err", e)

    print("\n=== Multi-value child tables for FIS (rows > jobs) ===")
    cur.execute(
        "SELECT TRIM(RDB$RELATION_NAME) FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG=0 AND RDB$VIEW_BLR IS NULL"
    )
    tables = [r[0] for r in cur.fetchall()]
    for t in tables:
        cur.execute(
            "SELECT COUNT(*) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME=? AND TRIM(RDB$FIELD_NAME)='JOB_UNIQUE'",
            [t],
        )
        if not cur.fetchone()[0]:
            continue
        try:
            cur.execute(f'SELECT COUNT(*), COUNT(DISTINCT x."JOB_UNIQUE") FROM "{t}" x JOIN "FIS_JOB" j ON x."JOB_UNIQUE"=j."JOB_UNIQUE"')
            total, jobs = cur.fetchone()
            if jobs and total > jobs * 1.05:  # multi-value
                cur.execute(
                    "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME=?",
                    [t],
                )
                cols = [r[0] for r in cur.fetchall()]
                refish = [c for c in cols if any(k in c for k in ("REF", "ORDER", "FLAG", "TYPE", "NOTE", "TEXT", "DESC", "MARK"))]
                print(f"  {t}: {total} rows / {jobs} jobs, cols={refish[:10]}")
        except Exception:
            pass

    print("\n=== Multi-value via JOB number (not JOB_UNIQUE) ===")
    for t in tables:
        cur.execute(
            "SELECT COUNT(*) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME=? AND TRIM(RDB$FIELD_NAME)='JOB'",
            [t],
        )
        if not cur.fetchone()[0]:
            continue
        if "JOB_UNIQUE" in [c for c in []]:
            pass
        try:
            cur.execute(f'SELECT COUNT(*), COUNT(DISTINCT x."JOB") FROM "{t}" x JOIN "FIS_JOB" j ON x."JOB"=j."JOB"')
            total, jobs = cur.fetchone()
            if jobs and total > jobs * 1.05:
                cur.execute("SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME=?", [t])
                cols = [r[0] for r in cur.fetchall()]
                refish = [c for c in cols if any(k in c for k in ("REF", "ORDER", "FLAG", "TYPE"))]
                if refish or t == "FRT_REFERENCE":
                    print(f"  {t}: {total} rows / {jobs} jobs, cols={refish or cols}")
        except Exception:
            pass

    print("\n=== FRT_REFERENCE: try DEPARTMENT + JOB composite (all combos) ===")
    for dept in ("FIS", "FES", "FEA", "FIA", "FI", "FE", None):
        cur.execute(
            'SELECT COUNT(*) FROM "FIS_JOB" j JOIN "FRT_REFERENCE" r ON r."JOB"=j."JOB" '
            'AND (r."DEPARTMENT" IS NOT DISTINCT FROM ?)',
            [dept],
        )
        n = cur.fetchone()[0]
        if n:
            print(f"  DEPT={dept!r}: {n}")

    print("\n=== FEA sample with both Reference + Order No (FRT_REFERENCE) ===")
    cur.execute(
        'SELECT j."JOB_UNIQUE", j."JOB", '
        'SUM(CASE WHEN TRIM(r."FLAG")=\'O\' THEN 1 ELSE 0 END) as ord, '
        'SUM(CASE WHEN r."FLAG" IS NULL OR TRIM(r."FLAG")<>\'O\' THEN 1 ELSE 0 END) as ref '
        'FROM "FEA_JOB" j JOIN "FRT_REFERENCE" r ON r."JOB"=j."JOB" '
        'GROUP BY 1,2 HAVING SUM(CASE WHEN TRIM(r."FLAG")=\'O\' THEN 1 ELSE 0 END)>0 '
        'AND SUM(CASE WHEN r."FLAG" IS NULL OR TRIM(r."FLAG")<>\'O\' THEN 1 ELSE 0 END)>0 '
        'ROWS 1 TO 3'
    )
    for row in cur.fetchall():
        ju, job, ord_n, ref_n = row
        print(f"job_unique={ju} job={job} refs={ref_n} orders={ord_n}")
        cur.execute('SELECT "ID", TRIM("REFERENCE"), TRIM("FLAG") FROM "FRT_REFERENCE" WHERE "JOB"=? ORDER BY "ID"', [job])
        for r in cur.fetchall():
            kind = "Order No" if (r[2] or "").strip() == "O" else "Reference"
            print(f"    [{kind}] {r[1]!r}")

    cur.close()
    con.close()


if __name__ == "__main__":
    main()
