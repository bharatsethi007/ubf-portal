#!/usr/bin/env python3
"""Inspect consignee/shipper NAME columns on TW job tables."""
import fdb

DB = r"C:\Users\BharatS\Documents\Customer Portal\UBNZ.FDB"
TABLES = ["FIA_JOB", "FIS_JOB", "FEA_JOB", "FES_JOB"]
FIELDS = ["CONS_NAME1", "CONS_NAME2", "SHIP_NAME1", "SHIP_NAME2", "CONSIGNEE", "SHIPPER"]


def main():
    con = fdb.connect(dsn=f"localhost:{DB}", user="SYSDBA", password="masterkey", charset="WIN1252")
    cur = con.cursor()
    for t in TABLES:
        cur.execute(
            "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS "
            "WHERE RDB$RELATION_NAME=? ORDER BY RDB$FIELD_POSITION",
            [t],
        )
        cols = {r[0] for r in cur.fetchall()}
        print(f"\n== {t} ==")
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        total = cur.fetchone()[0]
        print(f"  rows: {total}")
        for c in FIELDS:
            if c not in cols:
                print(f"  {c}: (column missing)")
                continue
            cur.execute(
                f'SELECT COUNT(*) FROM "{t}" WHERE "{c}" IS NOT NULL '
                f"AND TRIM(CAST(\"{c}\" AS VARCHAR(500))) <> ''"
            )
            n = cur.fetchone()[0]
            print(f"  {c}: {n}/{total} populated")
        if "CONS_NAME1" in cols:
            cur.execute(
                f'SELECT FIRST 3 TRIM("CONS_NAME1"), TRIM("SHIP_NAME1") FROM "{t}" '
                f"WHERE \"CONS_NAME1\" IS NOT NULL AND TRIM(CAST(\"CONS_NAME1\" AS VARCHAR(500))) <> ''"
            )
            for row in cur.fetchall():
                print(f"  sample CONS_NAME1 | SHIP_NAME1: {row[0]!r} | {row[1]!r}")
    cur.close()
    con.close()


if __name__ == "__main__":
    main()
