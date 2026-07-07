#!/usr/bin/env python3
import fdb

DB = r"C:\Users\BharatS\Documents\Customer Portal\UBNZ.FDB"


def main():
    con = fdb.connect(dsn=f"localhost:{DB}", user="SYSDBA", password="masterkey", charset="WIN1252")
    cur = con.cursor()

    print("== FIS_SHIPMENT.REFERENCE ==")
    cur.execute(
        'SELECT COUNT(*) FROM "FIS_SHIPMENT" WHERE "REFERENCE" IS NOT NULL AND TRIM("REFERENCE") <> \'\''
    )
    print("populated:", cur.fetchone()[0])
    cur.execute('SELECT FIRST 5 TRIM("REFERENCE"), "SHIPMENT" FROM "FIS_SHIPMENT" WHERE "REFERENCE" IS NOT NULL AND TRIM("REFERENCE") <> \'\'')
    print(cur.fetchall())

    print("\n== FIS_JOB join FIS_SHIPMENT REFERENCE ==")
    cur.execute(
        'SELECT FIRST 5 j."JOB_UNIQUE", j."JOB", TRIM(s."REFERENCE") '
        'FROM "FIS_JOB" j JOIN "FIS_SHIPMENT" s ON j."COMPANY"=s."COMPANY" AND j."BRANCH"=s."BRANCH" AND j."SHIPMENT"=s."SHIPMENT" '
        'WHERE s."REFERENCE" IS NOT NULL AND TRIM(s."REFERENCE") <> \'\''
    )
    print(cur.fetchall())

    print("\n== FRT_CONSIGNEE join FIS_JOB via JOB_UNIQUE ==")
    cur.execute(
        'SELECT COUNT(*) FROM "FRT_CONSIGNEE" c JOIN "FIS_JOB" j ON c."JOB_UNIQUE"=j."JOB_UNIQUE" '
        'WHERE c."REFERENCE" IS NOT NULL AND TRIM(c."REFERENCE") <> \'\''
    )
    print("FIS consignee refs:", cur.fetchone()[0])
    cur.execute(
        'SELECT FIRST 5 j."JOB_UNIQUE", j."JOB", TRIM(c."REFERENCE"), TRIM(c."CONT_NO") '
        'FROM "FRT_CONSIGNEE" c JOIN "FIS_JOB" j ON c."JOB_UNIQUE"=j."JOB_UNIQUE" '
        'WHERE c."REFERENCE" IS NOT NULL AND TRIM(c."REFERENCE") <> \'\''
    )
    print(cur.fetchall())

    print("\n== FRT_CONSIGNEE join FES_JOB ==")
    cur.execute(
        'SELECT COUNT(*) FROM "FRT_CONSIGNEE" c JOIN "FES_JOB" j ON c."JOB_UNIQUE"=j."JOB_UNIQUE" '
        'WHERE c."REFERENCE" IS NOT NULL AND TRIM(c."REFERENCE") <> \'\''
    )
    print("FES consignee refs:", cur.fetchone()[0])

    print("\n== FES ref sources compare ==")
    cur.execute(
        'SELECT COUNT(*) FROM "FES_JOB" j WHERE TRIM(j."BOOKING_REF") <> \'\' OR j."BOOKING_REF" IS NOT NULL'
    )
    print("FES BOOKING_REF populated:", cur.fetchone()[0])
    cur.execute(
        'SELECT COUNT(DISTINCT j."JOB_UNIQUE") FROM "FES_JOB" j JOIN "FRT_REFERENCE" r ON r."JOB"=j."JOB"'
    )
    print("FES FRT_REFERENCE:", cur.fetchone()[0])

    print("\n== FIS_JOB REF-like columns ==")
    cur.execute(
        "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME='FIS_JOB' "
        "AND (TRIM(RDB$FIELD_NAME) CONTAINING 'REF' OR TRIM(RDB$FIELD_NAME) CONTAINING 'ORDER')"
    )
    print([r[0] for r in cur.fetchall()])

    cur.close()
    con.close()


if __name__ == "__main__":
    main()
