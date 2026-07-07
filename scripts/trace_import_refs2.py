#!/usr/bin/env python3
import fdb

DB = r"C:\Users\BharatS\Documents\Customer Portal\UBNZ.FDB"
JOB_UNIQUE = 177964
CONSOL = 9846
OBL = "SZTAU26080467"


def connect():
    return fdb.connect(dsn=f"localhost:{DB}", user="SYSDBA", password="masterkey", charset="WIN1252")


def table_cols(cur, t):
    cur.execute(
        "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS "
        "WHERE RDB$RELATION_NAME=? ORDER BY RDB$FIELD_POSITION",
        [t],
    )
    return [r[0] for r in cur.fetchall()]


def main():
    con = connect()
    cur = con.cursor()

    print("=== Find anchor across modules ===")
    for jt, st, obl_col in [
        ("FIS_JOB", "FIS_SHIPMENT", "OCEAN_BILL"),
        ("FES_JOB", "FES_SHIPMENT", "OBILL"),
        ("FIA_JOB", "FIA_SHIPMENT", "MAWB"),
        ("FEA_JOB", "FEA_SHIPMENT", "MAWB"),
    ]:
        for q, p in [
            (f'SELECT "JOB_UNIQUE","JOB","SHIPMENT" FROM "{jt}" WHERE "JOB_UNIQUE"=?', [JOB_UNIQUE]),
            (f'SELECT j."JOB_UNIQUE",j."JOB",j."SHIPMENT" FROM "{jt}" j JOIN "{st}" s '
             f'ON j."COMPANY"=s."COMPANY" AND j."BRANCH"=s."BRANCH" AND j."SHIPMENT"=s."SHIPMENT" '
             f'WHERE j."SHIPMENT"=?', [CONSOL]),
            (f'SELECT j."JOB_UNIQUE",j."JOB",j."SHIPMENT" FROM "{jt}" j JOIN "{st}" s '
             f'ON j."COMPANY"=s."COMPANY" AND j."BRANCH"=s."BRANCH" AND j."SHIPMENT"=s."SHIPMENT" '
             f'WHERE TRIM(s."{obl_col}")=?', [OBL]),
            (f'SELECT "JOB_UNIQUE","JOB","SHIPMENT" FROM "{jt}" WHERE "JOB"=?', [JOB_UNIQUE]),
        ]:
            try:
                cur.execute(q, p)
                rows = cur.fetchall()
                if rows:
                    print(f"{jt} {q.split('WHERE')[1][:40]} -> {rows[:5]}")
            except Exception as e:
                pass

    print("\n=== FRT_REFERENCE full column list + distinct FLAG ===")
    cur.execute(
        "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS "
        "WHERE RDB$RELATION_NAME='FRT_REFERENCE' ORDER BY RDB$FIELD_POSITION"
    )
    print([r[0] for r in cur.fetchall()])
    cur.execute('SELECT TRIM("FLAG"), COUNT(*) FROM "FRT_REFERENCE" GROUP BY TRIM("FLAG")')
    print("FLAG:", cur.fetchall())

    print("\n=== All *REF* tables (system) ===")
    cur.execute(
        "SELECT TRIM(RDB$RELATION_NAME) FROM RDB$RELATIONS "
        "WHERE RDB$SYSTEM_FLAG=0 AND RDB$VIEW_BLR IS NULL "
        "AND (TRIM(RDB$RELATION_NAME) CONTAINING 'REF' OR TRIM(RDB$RELATION_NAME) CONTAINING 'ORDER') "
        "ORDER BY 1"
    )
    tables = [r[0] for r in cur.fetchall()]
    print(tables)

    # Inspect FIS-specific ref tables
    for t in tables:
        cols = table_cols(cur, t)
        print(f"\n--- {t} cols: {cols}")
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        print(f"rows: {cur.fetchone()[0]:,}")

    cur.close()
    con.close()


if __name__ == "__main__":
    main()
