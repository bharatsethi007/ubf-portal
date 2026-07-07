#!/usr/bin/env python3
import fdb

DB = r"C:\Users\BharatS\Documents\Customer Portal\UBNZ.FDB"


def connect():
    return fdb.connect(dsn=f"localhost:{DB}", user="SYSDBA", password="masterkey", charset="WIN1252")


def main():
    con = connect()
    cur = con.cursor()

    print("=== FRT_REFERENCE: Reference vs Order No (FLAG) ===")
    cur.execute(
        'SELECT CASE WHEN TRIM("FLAG")=\'O\' THEN \'Order No\' ELSE \'Reference\' END AS kind, COUNT(*) '
        'FROM "FRT_REFERENCE" GROUP BY 1'
    )
    print(cur.fetchall())

    print("\n=== Join counts by module (FRT_REFERENCE.JOB = job.JOB) ===")
    for mod, jt in [("FIS", "FIS_JOB"), ("FES", "FES_JOB"), ("FIA", "FIA_JOB"), ("FEA", "FEA_JOB")]:
        cur.execute(
            f'SELECT COUNT(DISTINCT j."JOB_UNIQUE") FROM "{jt}" j '
            f'JOIN "FRT_REFERENCE" r ON r."JOB"=j."JOB"'
        )
        jobs = cur.fetchone()[0]
        cur.execute(
            f'SELECT COUNT(*) FROM "{jt}" j JOIN "FRT_REFERENCE" r ON r."JOB"=j."JOB"'
        )
        rows = cur.fetchone()[0]
        cur.execute(
            f'SELECT COUNT(*) FROM "{jt}" j JOIN "FRT_REFERENCE" r ON r."JOB"=j."JOB" WHERE TRIM(r."FLAG")=\'O\''
        )
        order_rows = cur.fetchone()[0]
        cur.execute(
            f'SELECT COUNT(*) FROM "{jt}" j JOIN "FRT_REFERENCE" r ON r."JOB"=j."JOB" '
            f'AND (r."FLAG" IS NULL OR TRIM(r."FLAG")<>\'O\')'
        )
        ref_rows = cur.fetchone()[0]
        print(f"  {mod}: {jobs} jobs, {rows} total child rows ({ref_rows} ref / {order_rows} order)")

    print("\n=== Sample FIS job with most FRT_REFERENCE rows ===")
    cur.execute(
        'SELECT FIRST 1 j."JOB_UNIQUE", j."JOB", j."SHIPMENT", COUNT(*) '
        'FROM "FIS_JOB" j JOIN "FRT_REFERENCE" r ON r."JOB"=j."JOB" '
        'GROUP BY j."JOB_UNIQUE", j."JOB", j."SHIPMENT" ORDER BY 4 DESC'
    )
    sample = cur.fetchone()
    if sample:
        ju, job, shp, cnt = sample
        print(f"  job_unique={ju} job={job} shipment={shp} rows={cnt}")
        cur.execute(
            'SELECT TRIM(r."REFERENCE"), TRIM(r."FLAG"), r."DATE1", r."ID" '
            'FROM "FRT_REFERENCE" r WHERE r."JOB"=? ORDER BY r."ID"',
            [job],
        )
        for row in cur.fetchall():
            kind = "Order No" if (row[1] or "").strip() == "O" else "Reference"
            print(f"    [{kind}] {row[0]!r} id={row[3]}")
    else:
        print("  NO FIS jobs linked to FRT_REFERENCE")

    print("\n=== Tables with REFERENCE column + JOB_UNIQUE ===")
    cur.execute(
        "SELECT TRIM(r.RDB$RELATION_NAME), TRIM(rf.RDB$FIELD_NAME) "
        "FROM RDB$RELATION_FIELDS rf JOIN RDB$RELATIONS r ON r.RDB$RELATION_NAME=rf.RDB$RELATION_NAME "
        "WHERE r.RDB$SYSTEM_FLAG=0 AND r.RDB$VIEW_BLR IS NULL "
        "AND TRIM(rf.RDB$FIELD_NAME)='REFERENCE'"
    )
    ref_tables = {}
    for t, c in cur.fetchall():
        ref_tables.setdefault(t, []).append(c)
    for t in sorted(ref_tables):
        cur.execute(
            "SELECT COUNT(*) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME=? AND TRIM(RDB$FIELD_NAME)='JOB_UNIQUE'",
            [t],
        )
        has_ju = cur.fetchone()[0] > 0
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        cnt = cur.fetchone()[0]
        cols = []
        cur.execute(
            "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME=? ORDER BY RDB$FIELD_POSITION",
            [t],
        )
        cols = [r[0] for r in cur.fetchall()]
        print(f"  {t}: {cnt:,} rows, JOB_UNIQUE={has_ju}, cols={cols}")

    print("\n=== Tables with ORDER in name linked to FIS_JOB ===")
    for t in ["ORDER_JOB", "ORDERLINK", "FIS_ORDER", "FIS_JOB_ORDER", "FIS_JOBREF", "FIS_REFERENCE"]:
        cur.execute("SELECT COUNT(*) FROM RDB$RELATIONS WHERE RDB$RELATION_NAME=?", [t])
        if not cur.fetchone()[0]:
            continue
        cur.execute(
            "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME=? ORDER BY RDB$FIELD_POSITION",
            [t],
        )
        cols = [r[0] for r in cur.fetchall()]
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        print(f"  {t}: {cur.fetchone()[0]:,} rows, cols={cols[:20]}")

    print("\n=== ORDER_JOB join FIS ===")
    cur.execute(
        'SELECT COUNT(DISTINCT j."JOB_UNIQUE") FROM "FIS_JOB" j '
        'JOIN "ORDER_JOB" o ON o."JOB_UNIQUE"=j."JOB_UNIQUE"'
    )
    print("  FIS jobs in ORDER_JOB:", cur.fetchone()[0])
    cur.execute(
        'SELECT COUNT(DISTINCT j."JOB_UNIQUE") FROM "FES_JOB" j '
        'JOIN "ORDER_JOB" o ON o."JOB_UNIQUE"=j."JOB_UNIQUE"'
    )
    print("  FES jobs in ORDER_JOB:", cur.fetchone()[0])

    print("\n=== Search FIS tables containing REF or ORDER ===")
    cur.execute(
        "SELECT TRIM(RDB$RELATION_NAME) FROM RDB$RELATIONS "
        "WHERE RDB$SYSTEM_FLAG=0 AND RDB$VIEW_BLR IS NULL "
        "AND TRIM(RDB$RELATION_NAME) STARTING WITH 'FIS' "
        "AND (TRIM(RDB$RELATION_NAME) CONTAINING 'REF' OR TRIM(RDB$RELATION_NAME) CONTAINING 'ORDER')"
    )
    print([r[0] for r in cur.fetchall()])

    print("\n=== FIS_JOB columns containing REF or ORDER ===")
    cur.execute(
        "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME='FIS_JOB' "
        "AND (TRIM(RDB$FIELD_NAME) CONTAINING 'REF' OR TRIM(RDB$FIELD_NAME) CONTAINING 'ORDER')"
    )
    print([r[0] for r in cur.fetchall()])

    cur.close()
    con.close()


if __name__ == "__main__":
    main()
