#!/usr/bin/env python3
import fdb

DB = r"C:\Users\BharatS\Documents\Customer Portal\UBNZ.FDB"


def main():
    con = fdb.connect(dsn=f"localhost:{DB}", user="SYSDBA", password="masterkey", charset="WIN1252")
    cur = con.cursor()

    print("== FCL by mode (sea only via shipment join) ==")
    for mod, jt, st in (("FIS", "FIS_JOB", "FIS_SHIPMENT"), ("FES", "FES_JOB", "FES_SHIPMENT")):
        cur.execute(
            f'SELECT TRIM(j."FCL"), COUNT(*) FROM "{jt}" j '
            f'JOIN "{st}" s ON j."COMPANY"=s."COMPANY" AND j."BRANCH"=s."BRANCH" AND j."SHIPMENT"=s."SHIPMENT" '
            f'GROUP BY TRIM(j."FCL") ORDER BY 2 DESC'
        )
        print(mod, cur.fetchall())

    print("\n== FCL=Y vs containers (FES sample) ==")
    cur.execute(
        'SELECT TRIM(j."FCL"), COUNT(DISTINCT j."JOB_UNIQUE") '
        'FROM "FES_JOB" j '
        'LEFT JOIN "FRT_CONTAINER" c ON j."COMPANY"=c."COMPANY" AND j."BRANCH"=c."BRANCH" AND j."SHIPMENT"=c."SHIPMENT" '
        'GROUP BY TRIM(j."FCL")'
    )
    print("FES jobs by FCL (with container join attempt):", cur.fetchall())

    print("\n== FRT_REFERENCE DEPARTMENT values ==")
    cur.execute('SELECT TRIM("DEPARTMENT"), COUNT(*) FROM "FRT_REFERENCE" GROUP BY TRIM("DEPARTMENT") ORDER BY 2 DESC')
    print(cur.fetchall()[:20])

    print("\n== FRT_REFERENCE join FIS_JOB ==")
    cur.execute(
        'SELECT FIRST 5 j."JOB_UNIQUE", j."JOB", TRIM(j."FCL"), TRIM(r."REFERENCE"), TRIM(r."DEPARTMENT") '
        'FROM "FIS_JOB" j '
        'JOIN "FRT_REFERENCE" r ON r."JOB" = j."JOB" '
        'WHERE r."REFERENCE" IS NOT NULL AND r."REFERENCE" <> \'\''
    )
    print(cur.fetchall())

    print("\n== FRT_REFERENCE join FES_JOB ==")
    cur.execute(
        'SELECT FIRST 5 j."JOB_UNIQUE", j."JOB", TRIM(j."FCL"), TRIM(r."REFERENCE"), TRIM(r."DEPARTMENT") '
        'FROM "FES_JOB" j '
        'JOIN "FRT_REFERENCE" r ON r."JOB" = j."JOB" '
        'WHERE r."REFERENCE" IS NOT NULL AND r."REFERENCE" <> \'\''
    )
    print(cur.fetchall())

    print("\n== FIS_JOB with FRT_REFERENCE count ==")
    cur.execute(
        'SELECT COUNT(*) FROM "FIS_JOB" j WHERE EXISTS (SELECT 1 FROM "FRT_REFERENCE" r WHERE r."JOB"=j."JOB")'
    )
    print("FIS with ref:", cur.fetchone()[0])
    cur.execute(
        'SELECT COUNT(*) FROM "FES_JOB" j WHERE EXISTS (SELECT 1 FROM "FRT_REFERENCE" r WHERE r."JOB"=j."JOB")'
    )
    print("FES with ref:", cur.fetchone()[0])

    print("\n== FIS import ref via FRT_REFERENCE only (no BOOKING on job?) ==")
    cur.execute('SELECT FIRST 5 TRIM("BOOKING_REF") FROM "FIS_JOB" WHERE "BOOKING_REF" IS NOT NULL')
    print("FIS BOOKING_REF exists?", cur.fetchall())

    cur.execute(
        "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME='FIS_JOB' "
        "AND TRIM(RDB$FIELD_NAME) CONTAINING 'REF'"
    )
    print("FIS_JOB *REF* cols:", [r[0] for r in cur.fetchall()])

    cur.close()
    con.close()


if __name__ == "__main__":
    main()
