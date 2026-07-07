#!/usr/bin/env python3
import fdb

DB = r"C:\Users\BharatS\Documents\Customer Portal\UBNZ.FDB"


def main():
    con = connect()
    cur = con.cursor()

    print("=== ORDER_JOB all columns ===")
    cur.execute(
        "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME='ORDER_JOB' ORDER BY RDB$FIELD_POSITION"
    )
    print([r[0] for r in cur.fetchall()])

    print("\n=== ORDER_JOB × FIS counts ===")
    cur.execute('SELECT COUNT(*) FROM "ORDER_JOB" o JOIN "FIS_JOB" j ON o."JOB_UNIQUE"=j."JOB_UNIQUE"')
    print("child rows:", cur.fetchone()[0])
    cur.execute('SELECT COUNT(DISTINCT o."JOB_UNIQUE") FROM "ORDER_JOB" o JOIN "FIS_JOB" j ON o."JOB_UNIQUE"=j."JOB_UNIQUE"')
    print("FIS jobs:", cur.fetchone()[0])

    print("\n=== FIS job with most ORDER_JOB children ===")
    cur.execute(
        'SELECT FIRST 1 j."JOB_UNIQUE", j."JOB", j."SHIPMENT", COUNT(*) '
        'FROM "FIS_JOB" j JOIN "ORDER_JOB" o ON o."JOB_UNIQUE"=j."JOB_UNIQUE" '
        'GROUP BY 1,2,3 ORDER BY 4 DESC'
    )
    s = cur.fetchone()
    if s:
        ju, job, shp, n = s
        print(f"job_unique={ju} job={job} shipment={shp} rows={n}")
        cur.execute(
            'SELECT o."ID", TRIM(o."ORDER_NO"), TRIM(o."DESCRIPTION"), TRIM(o."BOOKING_REF"), TRIM(o."HOUSE"), TRIM(o."MASTER") '
            'FROM "ORDER_JOB" o WHERE o."JOB_UNIQUE"=? ORDER BY o."ID"',
            [ju],
        )
        for r in cur.fetchall():
            print(" ", r)

    print("\n=== FRT_REFERENCE structure recap ===")
    cur.execute('SELECT FIRST 3 * FROM "FRT_REFERENCE" WHERE TRIM("FLAG")=\'O\'')
    d = [x.strip() for x in cur.description]
    for row in cur.fetchall():
        print(dict(zip(d, row)))
    cur.execute('SELECT FIRST 3 * FROM "FRT_REFERENCE" WHERE "FLAG" IS NULL')
    for row in cur.fetchall():
        print(dict(zip(d, row)))

    print("\n=== FRT_REFERENCE × FEA sample (has both flag types) ===")
    cur.execute(
        'SELECT FIRST 1 j."JOB_UNIQUE", j."JOB" FROM "FEA_JOB" j '
        'JOIN "FRT_REFERENCE" r ON r."JOB"=j."JOB" GROUP BY 1,2 HAVING COUNT(*)>2'
    )
    fea = cur.fetchone()
    if fea:
        ju, job = fea
        print(f"FEA job_unique={ju} job={job}")
        cur.execute('SELECT "ID", TRIM("REFERENCE"), TRIM("FLAG") FROM "FRT_REFERENCE" WHERE "JOB"=? ORDER BY "ID"', [job])
        for r in cur.fetchall():
            print(f"  id={r[0]} ref={r[1]!r} flag={r[2]!r} -> {'Order No' if (r[2] or '').strip()=='O' else 'Reference'}")

    print("\n=== Search DEPARTMENT=FIS anywhere in FRT_REFERENCE ===")
    cur.execute('SELECT COUNT(*) FROM "FRT_REFERENCE" WHERE TRIM("DEPARTMENT")=\'FIS\'')
    print("count:", cur.fetchone()[0])

    print("\n=== Tables: JOB_UNIQUE + multi-row potential for FIS ===")
    cur.execute(
        "SELECT TRIM(RDB$RELATION_NAME) FROM RDB$RELATIONS WHERE RDB$SYSTEM_FLAG=0 AND RDB$VIEW_BLR IS NULL"
    )
    for t in [r[0] for r in cur.fetchall()]:
        cur.execute(
            "SELECT COUNT(*) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME=? AND TRIM(RDB$FIELD_NAME)='JOB_UNIQUE'",
            [t],
        )
        if not cur.fetchone()[0]:
            continue
        try:
            cur.execute(
                f'SELECT COUNT(DISTINCT x."JOB_UNIQUE") FROM "{t}" x JOIN "FIS_JOB" j ON x."JOB_UNIQUE"=j."JOB_UNIQUE"'
            )
            jobs = cur.fetchone()[0]
            if jobs < 100:
                continue
            cur.execute(f'SELECT COUNT(*) FROM "{t}" x JOIN "FIS_JOB" j ON x."JOB_UNIQUE"=j."JOB_UNIQUE"')
            rows = cur.fetchone()[0]
            tcols = []
            cur.execute(
                "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME=?",
                [t],
            )
            tcols = [r[0] for r in cur.fetchall()]
            refish = [c for c in tcols if any(k in c for k in ("REF", "ORDER", "NOTE", "DESC"))]
            if refish:
                print(f"  {t}: {jobs} FIS jobs, {rows} rows, cols={refish[:8]}")
        except Exception:
            pass

    print("\n=== CUSTMARKS_C × FIS ===")
    cur.execute('SELECT COUNT(DISTINCT j."JOB_UNIQUE") FROM "CUSTMARKS_C" c JOIN "FIS_JOB" j ON c."JOB_NO"=j."JOB"')
    print("jobs:", cur.fetchone()[0])
    cur.execute(
        'SELECT FIRST 3 j."JOB_UNIQUE", j."JOB", TRIM(c."REFERENCE") FROM "CUSTMARKS_C" c '
        'JOIN "FIS_JOB" j ON c."JOB_NO"=j."JOB" WHERE c."REFERENCE" IS NOT NULL AND TRIM(c."REFERENCE")<>'' '
    )
    print("samples:", cur.fetchall())

    cur.close()
    con.close()


def connect():
    return fdb.connect(dsn=f"localhost:{DB}", user="SYSDBA", password="masterkey", charset="WIN1252")


if __name__ == "__main__":
    main()
