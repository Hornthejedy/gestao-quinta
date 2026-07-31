#!/usr/bin/env python3
import hashlib
import json
import os
import re
import shutil
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8000"))
DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
DEFAULT_FARM_ID = os.environ.get("FARM_ID", "quinta_principal")
SYNC_SECRET = os.environ.get("SYNC_SECRET", "")
MAX_BODY_BYTES = int(os.environ.get("MAX_BODY_BYTES", str(25 * 1024 * 1024)))

RPC_NAMES = {
    "sync_get",
    "gestao_quinta_sync_pull",
    "sync_upsert",
    "gestao_quinta_sync_push",
}


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def safe_farm_id(value):
    farm_id = str(value or DEFAULT_FARM_ID).strip()
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,80}", farm_id):
        raise ValueError("farm_id invalido")
    return farm_id


def farm_dir(farm_id):
    return DATA_DIR / "farms" / farm_id


def data_path(farm_id):
    return farm_dir(farm_id) / "data.json"


def meta_path(farm_id):
    return farm_dir(farm_id) / "meta.json"


def backup_path(farm_id, timestamp):
    return farm_dir(farm_id) / "versions" / f"{timestamp.replace(':', '').replace('-', '')}.json"


def check_secret(body):
    provided = str(body.get("p_sync_secret") or body.get("sync_secret") or "").strip()
    expected = str(SYNC_SECRET or "").strip()
    if not expected:
        raise PermissionError("SYNC_SECRET nao configurado no servidor")
    if not hashlib.sha256(provided.encode()).digest() == hashlib.sha256(expected.encode()).digest():
        raise PermissionError("codigo privado de sincronizacao invalido")


def read_json(path, default=None):
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def write_json_atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(value, fh, ensure_ascii=False, separators=(",", ":"))
    tmp.replace(path)


def load_row(farm_id):
    data = read_json(data_path(farm_id))
    if data is None:
        return None
    meta = read_json(meta_path(farm_id), {}) or {}
    return {
        "farm_id": farm_id,
        "data": data,
        "updated_at": meta.get("updated_at") or now_iso(),
    }


def save_payload(farm_id, payload, updated_at=None):
    if not isinstance(payload, dict):
        raise ValueError("payload tem de ser um objeto JSON")
    existing = data_path(farm_id)
    timestamp = updated_at or now_iso()
    if existing.exists():
        dst = backup_path(farm_id, timestamp)
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(existing, dst)
    write_json_atomic(existing, payload)
    write_json_atomic(meta_path(farm_id), {"farm_id": farm_id, "updated_at": timestamp})
    return load_row(farm_id)


def payload_from_body(body):
    if isinstance(body.get("p_data"), dict):
        return body["p_data"]
    raw = body.get("p_payload")
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip():
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    raise ValueError("pedido sem p_data ou p_payload valido")


class Handler(BaseHTTPRequestHandler):
    server_version = "GestaoQuintaSync/1.0"

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args), flush=True)

    def send_json(self, status, value):
        body = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type, apikey, authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_json(204, {})

    def do_GET(self):
        path = urlparse(self.path).path
        if path in {"/health", "/api/health"}:
            self.send_json(200, {"ok": True, "updated_at": now_iso()})
            return
        self.send_json(404, {"message": "not found"})

    def do_POST(self):
        try:
            path = urlparse(self.path).path
            fn = path.rstrip("/").split("/")[-1]
            if fn not in RPC_NAMES:
                self.send_json(404, {"message": "rpc desconhecido"})
                return
            length = int(self.headers.get("content-length") or "0")
            if length > MAX_BODY_BYTES:
                self.send_json(413, {"message": "pedido demasiado grande"})
                return
            raw = self.rfile.read(length) if length else b"{}"
            body = json.loads(raw.decode("utf-8") or "{}")
            if not isinstance(body, dict):
                raise ValueError("body tem de ser objeto JSON")
            check_secret(body)
            farm_id = safe_farm_id(body.get("p_farm_id") or body.get("farm_id"))
            if fn in {"sync_get", "gestao_quinta_sync_pull"}:
                row = load_row(farm_id)
                self.send_json(200, row or {})
                return
            payload = payload_from_body(body)
            row = save_payload(farm_id, payload, body.get("p_updated_at") or now_iso())
            self.send_json(200, row)
        except PermissionError as exc:
            self.send_json(403, {"message": str(exc)})
        except Exception as exc:
            self.send_json(400, {"message": str(exc)})


def main():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Gestao Quinta sync API listening on {HOST}:{PORT}", flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
