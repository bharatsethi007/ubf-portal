#!/usr/bin/env python3
import fdb

DB = r"C:\Users\BharatS\Documents\Customer Portal\UBNZ.FDB"
TABLES = [
    "FIS_JOB", "FES_JOB", "FIS_SHIPMENT", "FES_SHIPMENT",
    "FIS_JOBCONT", "FRT_CONTAINER", "FRT_CONSIGNEE", "FRT_REFERENCE",
    "FRT_ORDER", "FRT_ORDERS", "FRT_JOBREF", "FRT_JOB_REFERENCE",
]
KEYS = ("LCL", "FCL", "LOAD", "CONT", "REF", "ORDER", "MARK", "TYPE", "STATUS", "FULL", "EMPTY", "FAK", "SHIPPER")


def table_cols(cur, t):
    cur.execute(
        "SELECT TRIM(RDB$FIELD_NAME) FROM RDB$RELATION_FIELDS "
        "WHERE RDB$RELATION_NAME=? ORDER BY RDB$FIELD_POSITION",
        [t],
    )
    return [r[0] for r in cur.fetchall()]


def exists(cur, t):
    cur.execute("SELECT COUNT(*) FROM RDB$RELATIONS WHERE RDB$RELATION_NAME=?", [t])
    return cur.fetchone()[0] > 0


def main():
    con = fdb.connect(dsn=f"localhost:{DB}", user="SYSDBA", password="masterkey", charset="WIN1252")
    cur = con.cursor()
    for t in TABLES:
        if not exists(cur, t):
            print(f"{t}: NOT FOUND")
            continue
        cols = table_cols(cur, t)
        hits = [c for c in cols if any(k in c for k in KEYS)]
        print(f"== {t} ({len(cols)} cols)")
        print("  hits:", ", ".join(hits) if hits else "(none)")
    cur.close()
    con.close()


if __name__ == "__main__":
    main()
