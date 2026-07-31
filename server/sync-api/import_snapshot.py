#!/usr/bin/env python3
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def main():
    if len(sys.argv) != 4:
        print("uso: import_snapshot.py <snapshot.json> <data_dir> <farm_id>", file=sys.stderr)
        return 2
    src = Path(sys.argv[1])
    data_dir = Path(sys.argv[2])
    farm_id = sys.argv[3]
    with src.open("r", encoding="utf-8") as fh:
        payload = json.load(fh)
    if not isinstance(payload, dict):
        raise SystemExit("snapshot tem de ser um objeto JSON")
    farm_dir = data_dir / "farms" / farm_id
    farm_dir.mkdir(parents=True, exist_ok=True)
    dst = farm_dir / "data.json"
    if dst.exists():
        backup_dir = farm_dir / "versions"
        backup_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(dst, backup_dir / ("before-import-" + now_iso().replace(":", "").replace("-", "") + ".json"))
    with dst.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
    with (farm_dir / "meta.json").open("w", encoding="utf-8") as fh:
        json.dump({"farm_id": farm_id, "updated_at": now_iso()}, fh, ensure_ascii=False)
    print(f"importado {src} para {dst}")


if __name__ == "__main__":
    main()
