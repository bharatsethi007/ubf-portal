#!/usr/bin/env python3
import fdb

DB = r"C:\Users\BharatS\Documents\Customer Portal\UBNZ.FDB"


def main():
    con = connect()
    cur = con.cursor()

    print("=== FRT_REFERENCE.JOB = FIS_JOB.JOB_UNIQUE ===")
    cur.execute('SELECT COUNT(*) FROM "FRT_REFERENCE" r JOIN "FIS_JOB" j ON r."JOB"=j."JOB_UNIQUE"')
    total = cur.fetchone()[0]
    cur.execute('SELECT COUNT(DISTINCT j."JOB_UNIQUE") FROM "FRT_REFERENCE" r JOIN "FIS_JOB" j ON r."JOB"=j."JOB_UNIQUE"')
    jobs = cur.fetchone()[0]
    cur.execute(
        'SELECT COUNT(*) FROM "FRT_REFERENCE" r JOIN "FIS_JOB" j ON r."JOB"=j."JOB_UNIQUE" '
        'WHERE r."FLAG" IS NULL OR TRIM(r."FLAG")<>\'O\''
    )
    refs = cur.fetchone()[0]
    cur.execute(
        'SELECT COUNT(*) FROM "FRT_REFERENCE" r JOIN "FIS_JOB" j ON r."JOB"=j."JOB_UNIQUE" WHERE TRIM(r."FLAG")=\'O\''
    )
    orders = cur.fetchone()[0]
    print(f"FIS: {jobs} jobs, {total} rows ({refs} Reference / {orders} Order No)")

    print("\n=== Compare join keys all modules ===")
    for mod, jt in [("FIS", "FIS_JOB"), ("FES", "FES_JOB"), ("FEA", "FEA_JOB"), ("FIA", "FIA_JOB")]:
        cur.execute(f'SELECT COUNT(*) FROM "FRT_REFERENCE" r JOIN "{jt}" j ON r."JOB"=j."JOB"')
        by_job = cur.fetchone()[0]
        cur.execute(f'SELECT COUNT(*) FROM "FRT_REFERENCE" r JOIN "{jt}" j ON r."JOB"=j."JOB_UNIQUE"')
        by_ju = cur.fetchone()[0]
        print(f"  {mod}: by JOB={by_job}, by JOB_UNIQUE={by_ju}")

    print("\n=== FIS sample job with multiple FRT_REFERENCE rows (JOB_UNIQUE join) ===")
    cur.execute(
        'SELECT FIRST 1 j."JOB_UNIQUE", j."JOB", j."SHIPMENT", COUNT(*) '
        'FROM "FIS_JOB" j JOIN "FRT_REFERENCE" r ON r."JOB"=j."JOB_UNIQUE" '
        'GROUP BY 1,2,3 ORDER BY 4 DESC'
    )
    s = cur.fetchone()
    if s:
        ju, job, shp, n = s
        print(f"job_unique={ju} job={job} shipment={shp} rows={n}")
        cur.execute(
            'SELECT r."ID", TRIM(r."REFERENCE"), TRIM(r."FLAG"), TRIM(r."DEPARTMENT") '
            'FROM "FRT_REFERENCE" r WHERE r."JOB"=? ORDER BY r."ID"',
            [ju],
        )
        for r in cur.fetchall():
            kind = "Order No" if (r[2] or "").strip() == "O" else "Reference"
            print(f"  [{kind}] {r[1]!r} id={r[0]} dept={r[3]!r}")

        cur.execute(
            'SELECT TRIM(s."OCEAN_BILL") FROM "FIS_SHIPMENT" s '
            'JOIN "FIS_JOB" j ON j."COMPANY"=s."COMPANY" AND j."BRANCH"=s."BRANCH" AND j."SHIPMENT"=s."SHIPMENT" '
            'WHERE j."JOB_UNIQUE"=?',
            [ju],
        )
        print("  OBL:", cur.fetchone())

    print("\n=== FES counts (JOB vs JOB_UNIQUE) ===")
    for join in ("j.\"JOB\"", "j.\"JOB_UNIQUE\""):
        cur.execute(f'SELECT COUNT(DISTINCT j."JOB_UNIQUE") FROM "FRT_REFERENCE" r JOIN "FES_JOB" j ON r."JOB"={join.split(".")[1]}')
        # fix query
    cur.execute('SELECT COUNT(DISTINCT j."JOB_UNIQUE") FROM "FRT_REFERENCE" r JOIN "FES_JOB" j ON r."JOB"=j."JOB"')
    print("FES by JOB:", cur.fetchone()[0])
    cur.execute('SELECT COUNT(DISTINCT j."JOB_UNIQUE") FROM "FRT_REFERENCE" r JOIN "FES_JOB" j ON r."JOB"=j."JOB_UNIQUE"')
    print("FES by JOB_UNIQUE:", cur.fetchone()[0])

    print("\n=== Search consol 9846 / OBL in FIS ===")
    cur.execute('SELECT "SHIPMENT", TRIM("OCEAN_BILL") FROM "FIS_SHIPMENT" WHERE "SHIPMENT"=9846')
    print("consol:", cur.fetchone())
    cur.execute('SELECT "SHIPMENT", TRIM("OCEAN_BILL") FROM "FIS_SHIPMENT" WHERE TRIM("OCEAN_BILL") CONTAINING \'SZTAU\'')
    print("OBL like SZTAU:", cur.fetchall())

    cur.close()
    con.close()


def connect():
    return fdb.connect(dsn=f"localhost:{DB}", user="SYSDBA", password="masterkey", charset="WIN1252")


if __name__ == "__main__":
    main()
