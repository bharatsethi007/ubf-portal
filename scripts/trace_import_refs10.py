#!/usr/bin/env python3
import fdb

DB = r"C:\Users\BharatS\Documents\Customer Portal\UBNZ.FDB"


def main():
    con = connect()
    cur = con.cursor()

    print("=== FIS FRT_REFERENCE: all FLAG values ===")
    cur.execute(
        'SELECT TRIM(r."FLAG"), COUNT(*) FROM "FRT_REFERENCE" r '
        'JOIN "FIS_JOB" j ON r."JOB"=j."JOB_UNIQUE" GROUP BY TRIM(r."FLAG")'
    )
    print(cur.fetchall())

    print("\n=== FIS jobs with Order No (FLAG=O) via JOB_UNIQUE ===")
    cur.execute(
        'SELECT FIRST 5 j."JOB_UNIQUE", j."JOB", j."SHIPMENT", TRIM(r."REFERENCE") '
        'FROM "FRT_REFERENCE" r JOIN "FIS_JOB" j ON r."JOB"=j."JOB_UNIQUE" WHERE TRIM(r."FLAG")=\'O\''
    )
    print(cur.fetchall())

    print("\n=== FIS multi-value Reference sample (3+ rows) ===")
    cur.execute(
        'SELECT FIRST 3 j."JOB_UNIQUE", j."JOB", j."SHIPMENT", COUNT(*) '
        'FROM "FIS_JOB" j JOIN "FRT_REFERENCE" r ON r."JOB"=j."JOB_UNIQUE" '
        'GROUP BY 1,2,3 HAVING COUNT(*)>=3 ORDER BY 4 DESC'
    )
    for ju, job, shp, n in cur.fetchall():
        print(f"\njob_unique={ju} job={job} shipment={shp} ({n} rows)")
        cur.execute('SELECT TRIM(s."OCEAN_BILL") FROM "FIS_SHIPMENT" s JOIN "FIS_JOB" j ON j."SHIPMENT"=s."SHIPMENT" AND j."COMPANY"=s."COMPANY" AND j."BRANCH"=s."BRANCH" WHERE j."JOB_UNIQUE"=?', [ju])
        print("  OBL:", cur.fetchone())
        cur.execute('SELECT r."ID", TRIM(r."REFERENCE"), TRIM(r."FLAG") FROM "FRT_REFERENCE" r WHERE r."JOB"=? ORDER BY r."ID"', [ju])
        for r in cur.fetchall():
            kind = "Order No" if (r[2] or "").strip() == "O" else "Reference"
            print(f"  [{kind}] {r[1]!r}")

    print("\n=== FES join key confirmation ===")
    cur.execute('SELECT COUNT(DISTINCT j."JOB_UNIQUE") FROM "FRT_REFERENCE" r JOIN "FES_JOB" j ON r."JOB"=j."JOB"')
    print("FES by JOB (job no):", cur.fetchone()[0], "jobs")
    cur.execute(
        'SELECT COUNT(*) FROM "FRT_REFERENCE" r JOIN "FES_JOB" j ON r."JOB"=j."JOB" WHERE TRIM(r."FLAG")=\'O\''
    )
    print("  Order No rows:", cur.fetchone()[0])
    cur.execute(
        'SELECT COUNT(*) FROM "FRT_REFERENCE" r JOIN "FES_JOB" j ON r."JOB"=j."JOB" AND (r."FLAG" IS NULL OR TRIM(r."FLAG")<>\'O\')'
    )
    print("  Reference rows:", cur.fetchone()[0])

    print("\n=== FIS Order No elsewhere? ORDER_JOB ORDER_NO ===")
    cur.execute(
        'SELECT COUNT(*) FROM "ORDER_JOB" o JOIN "FIS_JOB" j ON o."JOB_UNIQUE"=j."JOB_UNIQUE" '
        'WHERE o."ORDER_NO" IS NOT NULL AND TRIM(o."ORDER_NO") <> \'\''
    )
    print("FIS ORDER_JOB with ORDER_NO:", cur.fetchone()[0])
    cur.execute(
        'SELECT FIRST 3 j."JOB_UNIQUE", TRIM(o."ORDER_NO"), TRIM(o."DESCRIPTION") '
        'FROM "ORDER_JOB" o JOIN "FIS_JOB" j ON o."JOB_UNIQUE"=j."JOB_UNIQUE" '
        'WHERE o."ORDER_NO" IS NOT NULL AND TRIM(o."ORDER_NO") <> \'\''
    )
    print("samples:", cur.fetchall())

    print("\n=== DEPARTMENT column — any non-null? ===")
    cur.execute('SELECT TRIM("DEPARTMENT"), COUNT(*) FROM "FRT_REFERENCE" WHERE "DEPARTMENT" IS NOT NULL GROUP BY 1')
    print(cur.fetchall() or "all NULL")

    cur.close()
    con.close()


def connect():
    return fdb.connect(dsn=f"localhost:{DB}", user="SYSDBA", password="masterkey", charset="WIN1252")


if __name__ == "__main__":
    main()
