#!/usr/bin/env python3
import fdb

DB = r"C:\Users\BharatS\Documents\Customer Portal\UBNZ.FDB"


def main():
    con = fdb.connect(dsn=f"localhost:{DB}", user="SYSDBA", password="masterkey", charset="WIN1252")
    cur = con.cursor()

    for col in ("CLIENT_REF", "CUST_REF", "SHIPPER_REF", "YOUR_REF", "REFERENCE", "ORDER_NO", "ORDER_REF"):
        cur.execute(
            "SELECT COUNT(*) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME='FIS_JOB' AND TRIM(RDB$FIELD_NAME)=?",
            [col],
        )
        if cur.fetchone()[0]:
            cur.execute(f'SELECT COUNT(*) FROM "FIS_JOB" WHERE "{col}" IS NOT NULL AND TRIM("{col}") <> \'\'')
            print(f"FIS_JOB.{col} populated:", cur.fetchone()[0])

    cur.execute(
        "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME='FIS_JOB' "
        "AND TRIM(RDB$FIELD_NAME) CONTAINING 'REF'"
    )
    print("FIS_JOB *REF*:", [r[0] for r in cur.fetchall()])

    cur.execute(
        "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME='FIA_JOB' "
        "AND TRIM(RDB$FIELD_NAME) CONTAINING 'REF'"
    )
    print("FIA_JOB *REF*:", [r[0] for r in cur.fetchall()])

    cur.execute(
        'SELECT COUNT(*) FROM "FIA_JOB" j JOIN "FRT_REFERENCE" r ON r."JOB"=j."JOB" '
        'WHERE r."REFERENCE" IS NOT NULL AND TRIM(r."REFERENCE") <> \'\''
    )
    print("FIA FRT_REFERENCE:", cur.fetchone()[0])

    cur.execute(
        'SELECT COUNT(*) FROM "FIS_JOB" j JOIN "FRT_CONSIGNEE" c ON c."JOB_UNIQUE"=j."JOB_UNIQUE"'
    )
    print("FIS FRT_CONSIGNEE rows:", cur.fetchone()[0])

    cur.execute('SELECT FIRST 3 * FROM "FRT_CONSIGNEE"')
    cols = [d[0].strip() for d in cur.description]
    for row in cur.fetchall():
        print(dict(zip(cols, row)))

    cur.close()
    con.close()


if __name__ == "__main__":
    main()
