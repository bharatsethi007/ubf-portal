#!/usr/bin/env python3
"""Trace import reference/order child tables for job 177964. READ-ONLY."""
import fdb

DB = r"C:\Users\BharatS\Documents\Customer Portal\UBNZ.FDB"
JOB_UNIQUE = 177964
CONSOL = 9846
OBL = "SZTAU26080467"


def connect():
    return fdb.connect(dsn=f"localhost:{DB}", user="SYSDBA", password="masterkey", charset="WIN1252")


def table_cols(cur, t):
    cur.execute(
        "SELECT TRIM(RDB$FIELD_NAME), TRIM(RDB$FIELD_SOURCE) "
        "FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME=? ORDER BY RDB$FIELD_POSITION",
        [t],
    )
    return cur.fetchall()


def exists(cur, t):
    cur.execute("SELECT COUNT(*) FROM RDB$RELATIONS WHERE RDB$RELATION_NAME=?", [t])
    return cur.fetchone()[0] > 0


def list_tables(cur, pattern):
    cur.execute(
        "SELECT TRIM(RDB$RELATION_NAME) FROM RDB$RELATIONS "
        "WHERE RDB$SYSTEM_FLAG=0 AND RDB$VIEW_BLR IS NULL "
        "AND TRIM(RDB$RELATION_NAME) CONTAINING ? ORDER BY 1",
        [pattern],
    )
    return [r[0] for r in cur.fetchall()]


def main():
    con = connect()
    cur = con.cursor()

    print("=== Anchor job (FIS) ===")
    cur.execute(
        'SELECT j."JOB_UNIQUE", j."JOB", j."SHIPMENT", TRIM(j."FCL"), TRIM(j."HOUSEBILL"), '
        'TRIM(s."OCEAN_BILL"), TRIM(s."REFERENCE") '
        'FROM "FIS_JOB" j '
        'LEFT JOIN "FIS_SHIPMENT" s ON j."COMPANY"=s."COMPANY" AND j."BRANCH"=s."BRANCH" AND j."SHIPMENT"=s."SHIPMENT" '
        'WHERE j."JOB_UNIQUE"=?',
        [JOB_UNIQUE],
    )
    row = cur.fetchone()
    print(row)
    if not row:
        print("Job not found!")
        return
    job_unique, job_no, shipment_no, fcl, house, obl, sref = row
    print(f"  job_no={job_no} shipment_no={shipment_no} obl={obl} consol_ref_on_shipment={sref}")

    print("\n=== FRT_REFERENCE — all columns ===")
    if exists(cur, "FRT_REFERENCE"):
        for c, src in table_cols(cur, "FRT_REFERENCE"):
            print(f"  {c} ({src})")
        cur.execute('SELECT COUNT(*) FROM "FRT_REFERENCE"')
        print(f"  total rows: {cur.fetchone()[0]}")
        cur.execute('SELECT TRIM("DEPARTMENT"), COUNT(*) FROM "FRT_REFERENCE" GROUP BY TRIM("DEPARTMENT")')
        print("  DEPARTMENT values:", cur.fetchall())

    print("\n=== Tables matching *REF* or *ORDER* ===")
    ref_tables = sorted(set(list_tables(cur, "REF") + list_tables(cur, "ORDER")))
    for t in ref_tables:
        cols = [c for c, _ in table_cols(cur, t)]
        keyish = [c for c in cols if any(k in c for k in ("JOB", "UNIQUE", "SHIPMENT", "CONSOL", "OBL", "BILL", "ORDER", "REF", "TYPE", "DEPT", "MODULE", "FLAG", "CATEGORY"))]
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        cnt = cur.fetchone()[0]
        print(f"  {t} ({cnt:,} rows) keys: {', '.join(keyish[:12])}")

    print("\n=== Probe FRT_REFERENCE joins for job 177964 ===")
    probes = [
        ('JOB_UNIQUE=?', [JOB_UNIQUE]),
        ('JOB=?', [job_no]),
        ('JOB=? AND TRIM(DEPARTMENT)=\'FIS\'', [job_no]),
        ('JOB=? AND DEPARTMENT IS NULL', [job_no]),
    ]
    for where, params in probes:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "FRT_REFERENCE" WHERE {where}', params)
            print(f"  WHERE {where}: {cur.fetchone()[0]}")
        except Exception as e:
            print(f"  WHERE {where}: ERROR {e}")

    # Try all columns that might link
    print("\n=== FRT_REFERENCE sample rows (any column = job/shipment/consol) ===")
    fr_cols = [c for c, _ in table_cols(cur, "FRT_REFERENCE")]
    for col in fr_cols:
        try:
            cur.execute(f'SELECT COUNT(*) FROM "FRT_REFERENCE" WHERE "{col}"=?', [JOB_UNIQUE])
            n = cur.fetchone()[0]
            if n:
                print(f"  {col}={JOB_UNIQUE}: {n} rows")
                cur.execute(f'SELECT FIRST 5 * FROM "FRT_REFERENCE" WHERE "{col}"=?', [JOB_UNIQUE])
                cols = [d[0].strip() for d in cur.description]
                for r in cur.fetchall():
                    print("   ", dict(zip(cols, r)))
        except Exception:
            pass
        try:
            cur.execute(f'SELECT COUNT(*) FROM "FRT_REFERENCE" WHERE "{col}"=?', [job_no])
            n = cur.fetchone()[0]
            if n:
                print(f"  {col}={job_no}: {n} rows")
        except Exception:
            pass
        try:
            cur.execute(f'SELECT COUNT(*) FROM "FRT_REFERENCE" WHERE "{col}"=?', [shipment_no])
            n = cur.fetchone()[0]
            if n:
                print(f"  {col}={shipment_no} (shipment): {n} rows")
        except Exception:
            pass

    print("\n=== Search child tables for job 177964 / consol 9846 / OBL ===")
    candidates = [t for t in ref_tables if t != "FRT_REFERENCE" or True]
    for t in candidates[:40]:
        cols = [c for c, _ in table_cols(cur, t)]
        hits = []
        for col in cols:
            for val in (JOB_UNIQUE, job_no, shipment_no, CONSOL, OBL):
                if val is None:
                    continue
                try:
                    cur.execute(f'SELECT COUNT(*) FROM "{t}" WHERE TRIM(CAST("{col}" AS VARCHAR(100)))=?', [str(val)])
                    n = cur.fetchone()[0]
                    if n:
                        hits.append((col, val, n))
                except Exception:
                    try:
                        cur.execute(f'SELECT COUNT(*) FROM "{t}" WHERE "{col}"=?', [val])
                        n = cur.fetchone()[0]
                        if n:
                            hits.append((col, val, n))
                    except Exception:
                        pass
        if hits:
            print(f"\n  {t}:")
            for col, val, n in hits[:6]:
                print(f"    {col}={val!r} -> {n} rows")
                cur.execute(f'SELECT FIRST 3 * FROM "{t}" WHERE "{col}"=?', [val])
                dcols = [d[0].strip() for d in cur.description]
                for r in cur.fetchall():
                    print("      ", {k: v for k, v in zip(dcols, r) if v is not None and str(v).strip()})

    cur.close()
    con.close()


if __name__ == "__main__":
    main()
