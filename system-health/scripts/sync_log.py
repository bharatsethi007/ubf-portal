"""
sync_log.py - writes each TWF/FDB sync run to Supabase public.sync_runs
so it shows on Setup > System health > TWF sync.

No extra packages. Copy next to sync_to_supabase.py and wrap the main run:

    from sync_log import SyncRun

    with SyncRun(script="sync_to_supabase.py") as run:
        ...existing sync code...            # every print() is captured into the run log
        run.count("FIA", 1810)               # optional per-module row counts (shows as chips)
        run.message = "1813 shipments"       # optional one-line summary

Env (same .env the sync already uses):
    SUPABASE_URL                 https://cpnkudbdzgnzmodhsrbf.supabase.co
    SUPABASE_SERVICE_ROLE_KEY    service role key (or SUPABASE_SERVICE_KEY)
    SYNC_SOURCE                  optional, default TWF-NZ (use TWF-FJ / TWF-AU later)

Logging never breaks the sync: any Supabase error is printed and ignored.
"""
import io
import json
import os
import socket
import sys
import traceback
import urllib.request
from datetime import datetime, timezone

MAX_LOG = 200_000


def _now():
    return datetime.now(timezone.utc).isoformat()


class _Tee(io.TextIOBase):
    def __init__(self, a, b):
        self.a, self.b = a, b

    def write(self, s):
        self.a.write(s)
        self.b.write(s)
        return len(s)

    def flush(self):
        self.a.flush()


class SyncRun:
    def __init__(self, script=None, source=None):
        self.url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        self.key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY", "")
        self.source = source or os.environ.get("SYNC_SOURCE", "TWF-NZ")
        self.script = script or os.path.basename(sys.argv[0])
        self.modules = {}
        self.rows = 0
        self.message = None
        self.id = None
        self._buf = io.StringIO()
        self._out = None

    def count(self, module, n):
        self.modules[module] = self.modules.get(module, 0) + int(n or 0)
        self.rows += int(n or 0)

    def _req(self, method, path, body):
        if not self.url or not self.key:
            return None
        req = urllib.request.Request(
            f"{self.url}/rest/v1/{path}",
            data=json.dumps(body).encode(),
            method=method,
            headers={
                "apikey": self.key,
                "Authorization": f"Bearer {self.key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read() or b"null")
        except Exception as e:  # never break the sync
            sys.__stdout__.write(f"[sync_log] could not write run: {e}\n")
            return None

    def __enter__(self):
        res = self._req("POST", "sync_runs", {
            "source": self.source, "script": self.script, "host": socket.gethostname(),
            "status": "running", "started_at": _now(),
        })
        if isinstance(res, list) and res:
            self.id = res[0].get("id")
        self._out = sys.stdout
        sys.stdout = _Tee(self._out, self._buf)
        return self

    def __exit__(self, exc_type, exc, tb):
        sys.stdout = self._out
        log = self._buf.getvalue()
        if exc_type:
            log += "\n" + "".join(traceback.format_exception(exc_type, exc, tb))
        if len(log) > MAX_LOG:
            log = log[-MAX_LOG:]
        body = {
            "status": "error" if exc_type else "ok",
            "finished_at": _now(),
            "modules": self.modules or None,
            "rows_written": self.rows or None,
            "message": (str(exc)[:500] if exc_type else (self.message or "Sync complete")),
            "log": log,
        }
        if self.id:
            self._req("PATCH", f"sync_runs?id=eq.{self.id}", body)
        return False  # re-raise any error so the scheduler still sees the failure
