#!/usr/bin/env python3
import fdb

DB = r"C:\Users\BharatS\Documents\Customer Portal\UBNZ.FDB"


def field_type(cur, table, col):
    cur.execute(
        "SELECT f.RDB$FIELD_TYPE, f.RDB$FIELD_LENGTH, f.RDB$FIELD_SCALE "
        "FROM RDB$RELATION_FIELDS rf JOIN RDB$FIELDS f ON rf.RDB$FIELD_SOURCE=f.RDB$FIELD_NAME "
        "WHERE rf.RDB$RELATION_NAME=? AND TRIM(rf.RDB$FIELD_NAME)=?",
        [table, col],
    )
    return cur.fetchone()


def main():
    con = connect()
    cur = con.cursor()

    print("=== FRT_REFERENCE column types ===")
    for col in ["JOB", "DEPARTMENT", "REFERENCE", "FLAG", "ID", "DATE1"]:
        print(f"  {col}: {field_type(cur, 'FRT_REFERENCE', col)}")

    print("\n=== FIS_JOB key column types ===")
    for col in ["JOB", "JOB_UNIQUE", "SHIPMENT"]:
        print(f"  {col}: {field_type(cur, 'FIS_JOB', col)}")

    print("\n=== Does job 177964 exist? ===")
    cur.execute('SELECT "JOB_UNIQUE","JOB","SHIPMENT", TRIM("HOUSEBILL") FROM "FIS_JOB" WHERE "JOB_UNIQUE"=177964')
    print("by JOB_UNIQUE:", cur.fetchone())
    cur.execute('SELECT "JOB_UNIQUE","JOB","SHIPMENT" FROM "FIS_JOB" WHERE "JOB"=177964')
    print("by JOB:", cur.fetchone())

    print("\n=== Jobs near 177964 ===")
    cur.execute('SELECT "JOB_UNIQUE","JOB","SHIPMENT" FROM "FIS_JOB" WHERE "JOB_UNIQUE" BETWEEN 177960 AND 177970 ORDER BY "JOB_UNIQUE"')
    print(cur.fetchall())

    print("\n=== FIS_JOBCONT columns ===")
    cur.execute(
        "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME='FIS_JOBCONT' ORDER BY RDB$FIELD_POSITION"
    )
    print([r[0] for r in cur.fetchall()])
    cur.execute('SELECT COUNT(*) FROM "FIS_JOBCONT"')
    print("rows:", cur.fetchone()[0])
    cur.execute(
        'SELECT COUNT(*) FROM "FIS_JOBCONT" c JOIN "FIS_JOB" j ON c."JOB_UNIQUE"=j."JOB_UNIQUE"'
    )
    print("FIS linked by JOB_UNIQUE:", cur.fetchone()[0])
    cur.execute(
        'SELECT COUNT(*) FROM "FIS_JOBCONT" c JOIN "FIS_JOB" j ON c."JOB"=j."JOB"'
    )
    print("FIS linked by JOB:", cur.fetchone()[0])

    print("\n=== Search *REFERENCE* tables with JOB_UNIQUE ===")
    cur.execute(
        "SELECT TRIM(r.RDB$RELATION_NAME) FROM RDB$RELATIONS r "
        "WHERE r.RDB$SYSTEM_FLAG=0 AND TRIM(r.RDB$RELATION_NAME) CONTAINING 'REFERENCE'"
    )
    for t in [x[0] for x in cur.fetchall()]:
        cur.execute(
            "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME=? ORDER BY RDB$FIELD_POSITION",
            [t],
        )
        cols = [r[0] for r in cur.fetchall()]
        print(f"  {t}: {cols}")

    print("\n=== FRT_REFERENCE join keys tested for FIS ===")
    tests = [
        ("r.JOB = j.JOB", 'JOIN "FRT_REFERENCE" r ON r."JOB"=j."JOB"'),
        ("r.JOB = j.JOB_UNIQUE (overflow risk)", 'JOIN "FRT_REFERENCE" r ON r."JOB"=j."JOB_UNIQUE"'),
        ("r.JOB = j.SHIPMENT", 'JOIN "FRT_REFERENCE" r ON r."JOB"=j."SHIPMENT"'),
    ]
    for label, join in tests:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "FIS_JOB" j {join}')
            print(f"  {label}: {cur.fetchone()[0]}")
        except Exception as e:
            print(f"  {label}: ERROR {str(e)[:80]}")

    print("\n=== Module row counts in FRT_REFERENCE (via correct job join) ===")
    for mod, jt in [("FES", "FES_JOB"), ("FEA", "FEA_JOB"), ("FIS", "FIS_JOB")]:
        cur.execute(f'SELECT COUNT(*) FROM "FRT_REFERENCE" r JOIN "{jt}" j ON r."JOB"=j."JOB"')
        total = cur.fetchone()[0]
        cur.execute(
            f'SELECT COUNT(*) FROM "FRT_REFERENCE" r JOIN "{jt}" j ON r."JOB"=j."JOB" '
            f'WHERE r."FLAG" IS NULL OR TRIM(r."FLAG")<>\'O\''
        )
        refs = cur.fetchone()[0]
        cur.execute(
            f'SELECT COUNT(*) FROM "FRT_REFERENCE" r JOIN "{jt}" j ON r."JOB"=j."JOB" WHERE TRIM(r."FLAG")=\'O\''
        )
        orders = cur.fetchone()[0]
        cur.execute(f'SELECT COUNT(DISTINCT j."JOB_UNIQUE") FROM "FRT_REFERENCE" r JOIN "{jt}" j ON r."JOB"=j."JOB"')
        jobs = cur.fetchone()[0]
        print(f"  {mod}: {jobs} jobs, {total} rows ({refs} Reference / {orders} Order No)")

    print("\n=== Nearest FIS job WITH FRT_REFERENCE rows (if any) ===")
    cur.execute(
        'SELECT FIRST 1 j."JOB_UNIQUE", j."JOB", j."SHIPMENT", TRIM(s."OCEAN_BILL") '
        'FROM "FIS_JOB" j JOIN "FIS_SHIPMENT" s ON j."COMPANY"=s."COMPANY" AND j."BRANCH"=s."BRANCH" AND j."SHIPMENT"=s."SHIPMENT" '
        'WHERE EXISTS (SELECT 1 FROM "FRT_REFERENCE" r WHERE r."JOB"=j."JOB")'
    )
    print(cur.fetchone())

    cur.close()
    con.close()


def connect():
    return fdb.connect(dsn=f"localhost:{DB}", user="SYSDBA", password="masterkey", charset="WIN1252")


if __name__ == "__main__":
    main()
