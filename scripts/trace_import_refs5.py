#!/usr/bin/env python3
"""Deep trace: FIS import references via ORDER_JOB, CUSTMARKS_C, child tables."""
import fdb

DB = r"C:\Users\BharatS\Documents\Customer Portal\UBNZ.FDB"


def connect():
    return fdb.connect(dsn=f"localhost:{DB}", user="SYSDBA", password="masterkey", charset="WIN1252")


def cols(cur, t):
    cur.execute(
        "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME=? ORDER BY RDB$FIELD_POSITION",
        [t],
    )
    return [r[0] for r in cur.fetchall()]


def main():
    con = connect()
    cur = con.cursor()

    print("=== ORDER_JOB for FIS — structure & samples ===")
    cur.execute(
        'SELECT COUNT(*), COUNT(DISTINCT "JOB_UNIQUE") FROM "ORDER_JOB" o '
        'JOIN "FIS_JOB" j ON o."JOB_UNIQUE"=j."JOB_UNIQUE"'
    )
    print("rows, jobs:", cur.fetchone())
    cur.execute(
        'SELECT FIRST 5 o."JOB_UNIQUE", o."JOB", TRIM(o."ORDER_NO"), TRIM(o."DESCRIPTION"), TRIM(o."BOOKING_REF") '
        'FROM "ORDER_JOB" o JOIN "FIS_JOB" j ON o."JOB_UNIQUE"=j."JOB_UNIQUE" '
        'WHERE o."ORDER_NO" IS NOT NULL AND TRIM(o."ORDER_NO") <> \'\''
    )
    print("ORDER_NO samples:", cur.fetchall())

    print("\n=== FIS job with multiple ORDER_JOB rows ===")
    cur.execute(
        'SELECT FIRST 1 j."JOB_UNIQUE", j."JOB", j."SHIPMENT", COUNT(*) '
        'FROM "FIS_JOB" j JOIN "ORDER_JOB" o ON o."JOB_UNIQUE"=j."JOB_UNIQUE" '
        'GROUP BY j."JOB_UNIQUE", j."JOB", j."SHIPMENT" HAVING COUNT(*)>1 ORDER BY 4 DESC'
    )
    s = cur.fetchone()
    if s:
        ju, job, shp, n = s
        print(f"job_unique={ju} job={job} shipment={shp} order_rows={n}")
        cur.execute(
            'SELECT o."ID", TRIM(o."ORDER_NO"), TRIM(o."DESCRIPTION"), TRIM(o."BOOKING_REF"), TRIM(o."HOUSE") '
            'FROM "ORDER_JOB" o WHERE o."JOB_UNIQUE"=? ORDER BY o."ID"',
            [ju],
        )
        for r in cur.fetchall():
            print(" ", r)

    print("\n=== CUSTMARKS_C for FIS (JOB_NO join) ===")
    cur.execute(
        'SELECT COUNT(*) FROM "CUSTMARKS_C" c JOIN "FIS_JOB" j ON c."JOB_NO"=j."JOB"'
    )
    print("rows:", cur.fetchone()[0])
    cur.execute(
        'SELECT FIRST 5 j."JOB_UNIQUE", j."JOB", TRIM(c."REFERENCE"), TRIM(c."MARKS") '
        'FROM "CUSTMARKS_C" c JOIN "FIS_JOB" j ON c."JOB_NO"=j."JOB" '
        'WHERE c."REFERENCE" IS NOT NULL AND TRIM(c."REFERENCE") <> \'\''
    )
    print("samples:", cur.fetchall())

    print("\n=== All FIS* tables ===")
    cur.execute(
        "SELECT TRIM(RDB$RELATION_NAME) FROM RDB$RELATIONS "
        "WHERE RDB$SYSTEM_FLAG=0 AND TRIM(RDB$RELATION_NAME) STARTING WITH 'FIS' ORDER BY 1"
    )
    fis_tables = [r[0] for r in cur.fetchall()]
    print(fis_tables)

    print("\n=== FIS child tables with JOB or JOB_UNIQUE linking to FIS_JOB ===")
    for t in fis_tables:
        if t in ("FIS_JOB", "FIS_SHIPMENT"):
            continue
        tcols = cols(cur, t)
        if "JOB_UNIQUE" not in tcols and "JOB" not in tcols:
            continue
        try:
            if "JOB_UNIQUE" in tcols:
                cur.execute(
                    f'SELECT COUNT(*) FROM "{t}" x JOIN "FIS_JOB" j ON x."JOB_UNIQUE"=j."JOB_UNIQUE"'
                )
            else:
                cur.execute(f'SELECT COUNT(*) FROM "{t}" x JOIN "FIS_JOB" j ON x."JOB"=j."JOB"')
            n = cur.fetchone()[0]
            if n:
                refcols = [c for c in tcols if "REF" in c or "ORDER" in c]
                print(f"  {t}: {n:,} rows, ref-ish cols: {refcols}")
        except Exception:
            pass

    print("\n=== FRT_REFERENCE with DEPARTMENT / module-specific join attempts ===")
    # Maybe JOB in FRT_REFERENCE is actually JOB_UNIQUE for some modules?
    cur.execute(
        'SELECT COUNT(*) FROM "FIS_JOB" j JOIN "FRT_REFERENCE" r ON r."JOB"=j."JOB_UNIQUE"'
    )
    print("FRT_REFERENCE.JOB = FIS JOB_UNIQUE:", cur.fetchone()[0])
    cur.execute(
        'SELECT COUNT(*) FROM "FIS_JOB" j JOIN "FRT_REFERENCE" r ON r."JOB"=j."JOB"'
    )
    print("FRT_REFERENCE.JOB = FIS JOB (number):", cur.fetchone()[0])

    # FIS shipment-level REFERENCE field population
    cur.execute(
        'SELECT COUNT(*) FROM "FIS_SHIPMENT" WHERE "REFERENCE" IS NOT NULL AND TRIM("REFERENCE") <> \'\''
    )
    print("FIS_SHIPMENT.REFERENCE populated:", cur.fetchone()[0])

    print("\n=== Search any table: both REFERENCE-like rows for same FIS job ===")
    # Pick rich FIS job from ORDER_JOB
    cur.execute(
        'SELECT FIRST 1 j."JOB_UNIQUE", j."JOB" FROM "FIS_JOB" j '
        'JOIN "ORDER_JOB" o ON o."JOB_UNIQUE"=j."JOB_UNIQUE" '
        'GROUP BY j."JOB_UNIQUE", j."JOB" ORDER BY COUNT(*) DESC'
    )
    anchor = cur.fetchone()
    if anchor:
        ju, job = anchor
        print(f"Probe job_unique={ju} job={job}")
        cur.execute('SELECT "ID", TRIM("ORDER_NO"), TRIM("DESCRIPTION") FROM "ORDER_JOB" WHERE "JOB_UNIQUE"=?', [ju])
        print("  ORDER_JOB:", cur.fetchall())
        cur.execute('SELECT "ID", TRIM("REFERENCE"), TRIM("FLAG") FROM "FRT_REFERENCE" WHERE "JOB"=?', [job])
        print("  FRT_REFERENCE (by job no):", cur.fetchall())
        cur.execute('SELECT "ID", TRIM("REFERENCE"), TRIM("FLAG") FROM "FRT_REFERENCE" WHERE "JOB"=?', [ju])
        print("  FRT_REFERENCE (by job_unique):", cur.fetchall())

    cur.close()
    con.close()


if __name__ == "__main__":
    main()
