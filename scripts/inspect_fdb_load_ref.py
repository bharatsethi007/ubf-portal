#!/usr/bin/env python3
import fdb

DB = r"C:\Users\BharatS\Documents\Customer Portal\UBNZ.FDB"


def q(cur, sql, params=None):
    cur.execute(sql, params or [])
    return cur.fetchall()


def main():
    con = fdb.connect(dsn=f"localhost:{DB}", user="SYSDBA", password="masterkey", charset="WIN1252")
    cur = con.cursor()

    print("== FCL values ==")
    for t in ("FIS_JOB", "FES_JOB"):
        cur.execute(f'SELECT TRIM("FCL"), COUNT(*) FROM "{t}" GROUP BY TRIM("FCL") ORDER BY 2 DESC')
        print(t, cur.fetchall()[:10])

    print("\n== FES_SHIPMENT LOADTYPE / FCL ==")
    cur.execute('SELECT TRIM("LOADTYPE"), TRIM("FCL"), COUNT(*) FROM "FES_SHIPMENT" GROUP BY TRIM("LOADTYPE"), TRIM("FCL") ORDER BY 3 DESC')
    for row in cur.fetchall()[:15]:
        print(row)

    print("\n== FRT_REFERENCE columns ==")
    cur.execute(
        "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME='FRT_REFERENCE' ORDER BY RDB$FIELD_POSITION"
    )
    print([r[0] for r in cur.fetchall()])

    print("\n== FRT_REFERENCE samples ==")
    cur.execute('SELECT FIRST 8 * FROM "FRT_REFERENCE"')
    cols = [d[0].strip() for d in cur.description]
    print("cols:", cols)
    for row in cur.fetchall():
        print(dict(zip(cols, row)))

    print("\n== FRT_CONSIGNEE columns (ref-related) ==")
    cur.execute(
        "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME='FRT_CONSIGNEE' ORDER BY RDB$FIELD_POSITION"
    )
    cols = [r[0] for r in cur.fetchall()]
    refcols = [c for c in cols if "REF" in c or c in ("JOB", "JOB_UNIQUE", "SHIPMENT", "MODULE", "CONT_NO", "MARKS")]
    print(refcols)

    print("\n== FRT_CONSIGNEE sample REFERENCE ==")
    cur.execute('SELECT FIRST 8 TRIM("REFERENCE"), TRIM("CONT_NO"), "JOB", "SHIPMENT" FROM "FRT_CONSIGNEE" WHERE "REFERENCE" IS NOT NULL AND "REFERENCE" <> \'\'')
    for row in cur.fetchall():
        print(row)

    print("\n== Job-level ref fields samples ==")
    cur.execute(
        'SELECT FIRST 5 j."JOB_UNIQUE", j."JOB", TRIM(j."FCL"), TRIM(s."REFERENCE") '
        'FROM "FIS_JOB" j LEFT JOIN "FIS_SHIPMENT" s ON j."COMPANY"=s."COMPANY" AND j."BRANCH"=s."BRANCH" AND j."SHIPMENT"=s."SHIPMENT" '
        'WHERE s."REFERENCE" IS NOT NULL AND s."REFERENCE" <> \'\''
    )
    print("FIS consol REFERENCE:", cur.fetchall())

    cur.execute(
        'SELECT FIRST 5 "JOB_UNIQUE", "JOB", TRIM("FCL"), TRIM("BOOKING_REF") FROM "FES_JOB" '
        'WHERE "BOOKING_REF" IS NOT NULL AND "BOOKING_REF" <> \'\''
    )
    print("FES BOOKING_REF:", cur.fetchall())

    cur.execute(
        'SELECT FIRST 5 "JOB_UNIQUE", "JOB", TRIM("FCL"), TRIM("CARRIER_BOOKING_REF") FROM "FES_JOB" '
        'WHERE "CARRIER_BOOKING_REF" IS NOT NULL AND "CARRIER_BOOKING_REF" <> \'\''
    )
    print("FES CARRIER_BOOKING_REF:", cur.fetchall())

    cur.close()
    con.close()


if __name__ == "__main__":
    main()
