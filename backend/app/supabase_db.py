from urllib.parse import urljoin
import httpx
import time as _time
import threading

from app.config import settings

SUPABASE_URL = settings.supabase_url or ""
SERVICE_KEY = settings.supabase_service_role_key or ""

_headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

_last_request = 0.0
_MIN_INTERVAL = 0.3
_lock = threading.Lock()


def _rate_limit():
    global _last_request
    with _lock:
        now = _time.time()
        since = now - _last_request
        if since < _MIN_INTERVAL:
            _time.sleep(_MIN_INTERVAL - since)
        _last_request = _time.time()


def _rest(path: str) -> str:
    return urljoin(f"{SUPABASE_URL}/rest/v1/", path.lstrip("/"))


def _request(method: str, url: str, *, headers: dict | None = None, json: dict | list | None = None, params: dict | None = None):
    _rate_limit()
    h = {**_headers, **(headers or {})}
    with httpx.Client(timeout=15.0) as client:
        r = client.request(method, url, headers=h, json=json, params=params)
        try:
            r.raise_for_status()
        except httpx.HTTPStatusError:
            raise
        try:
            return r.json()
        except Exception:
            return None


def select(table: str, *, columns: str = "*", filters: dict | None = None, order: str | None = None, limit: int | None = None, single: bool = False):
    params: dict[str, str] = {"select": columns}
    if filters:
        for k, v in filters.items():
            params[k] = v
    if order:
        params["order"] = order
    if limit:
        params["limit"] = str(limit)
    data = _request("GET", _rest(table), params=params)
    if data is None:
        data = []
    if single and isinstance(data, list):
        return data[0] if data else None
    return data


def insert(table: str, data: dict | list[dict]):
    headers = {"Prefer": "return=representation"}
    result = _request("POST", _rest(table), headers=headers, json=data)
    if result is None:
        return [data] if isinstance(data, dict) else data
    return result


def update(table: str, data: dict, filters: dict):
    params = "&".join(f"{k}={v}" for k, v in filters.items())
    headers = {"Prefer": "return=representation"}
    result = _request("PATCH", f"{_rest(table)}?{params}", headers=headers, json=data)
    if result is None:
        return [data]
    return result


def delete(table: str, filters: dict):
    params = "&".join(f"{k}={v}" for k, v in filters.items())
    result = _request("DELETE", f"{_rest(table)}?{params}")
    return result


def count(table: str, filters: dict | None = None) -> int:
    params: dict[str, str] = {"select": "count"}
    if filters:
        for k, v in filters.items():
            params[k] = v
    headers = {"Accept": "text/csv", "Prefer": "count=exact"}
    _rate_limit()
    h = {**_headers, **headers}
    with httpx.Client(timeout=15.0) as client:
        r = client.get(_rest(table), headers=h, params=params)
        r.raise_for_status()
        return int(r.headers.get("content-range", "0-0/0").split("/")[-1])


def raw(sql_or_func: str, params: dict | None = None):
    """Call a Supabase RPC function."""
    return _request("POST", _rest(f"rpc/{sql_or_func}"), json=params or {})


# ─── Supabase Storage ───────────────────────────────────────────────

STORAGE_BUCKET = "uploads"
STORAGE_URL = f"{SUPABASE_URL}/storage/v1"

_storage_headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
}


def _storage(path: str) -> str:
    return urljoin(f"{STORAGE_URL}/", path.lstrip("/"))


def storage_ensure_bucket():
    """Create the storage bucket if it doesn't exist."""
    with httpx.Client(timeout=15.0) as client:
        r = client.get(_storage("bucket"), headers=_storage_headers)
        r.raise_for_status()
        if any(b["name"] == STORAGE_BUCKET for b in r.json()):
            return
        r = client.post(_storage("bucket"), headers={**_storage_headers, "Content-Type": "application/json"}, json={"name": STORAGE_BUCKET, "public": False})
        r.raise_for_status()
        # Make bucket public so signed URLs work
        client.put(_storage(f"bucket/{STORAGE_BUCKET}"), headers={**_storage_headers, "Content-Type": "application/json"}, json={"public": True})


def storage_upload(storage_path: str, data: bytes, content_type: str = "application/octet-stream"):
    """Upload a file to Supabase Storage. Uses PUT with upsert so it works for new and existing files."""
    _rate_limit()
    url = _storage(f"object/{STORAGE_BUCKET}/{storage_path.lstrip('/')}")
    headers = {
        **_storage_headers,
        "Content-Type": content_type,
        "x-upsert": "true"
    }
    with httpx.Client(timeout=120.0) as client:
        r = client.put(url, headers=headers, content=data)
        r.raise_for_status()
        return storage_path


def storage_download(storage_path: str) -> bytes:
    """Download a file from Supabase Storage."""
    _rate_limit()
    url = _storage(f"object/{STORAGE_BUCKET}/{storage_path.lstrip('/')}")
    with httpx.Client(timeout=60.0) as client:
        r = client.get(url, headers=_storage_headers)
        r.raise_for_status()
        return r.content


def storage_delete(storage_path: str):
    """Delete a file from Supabase Storage."""
    _rate_limit()
    url = _storage(f"object/{STORAGE_BUCKET}/{storage_path.lstrip('/')}")
    with httpx.Client(timeout=15.0) as client:
        r = client.delete(url, headers=_storage_headers)
        r.raise_for_status()


def storage_signed_url(storage_path: str, expires_in: int = 3600) -> str:
    """Get a signed URL for temporary access."""
    _rate_limit()
    url = _storage(f"object/sign/{STORAGE_BUCKET}/{storage_path.lstrip('/')}")
    with httpx.Client(timeout=15.0) as client:
        r = client.post(url, headers={**_storage_headers, "Content-Type": "application/json"}, json={"expiresIn": expires_in})
        r.raise_for_status()
        return f"{STORAGE_URL}{r.json()['signedURL']}" if r.json().get("signedURL", "").startswith("/") else r.json()["signedURL"]


def storage_list(prefix: str = "") -> list[dict]:
    """List files under a prefix."""
    _rate_limit()
    url = _storage(f"object/list/{STORAGE_BUCKET}")
    with httpx.Client(timeout=15.0) as client:
        r = client.post(url, headers={**_storage_headers, "Content-Type": "application/json"}, json={"prefix": prefix.lstrip("/"), "sortBy": {"column": "name", "order": "asc"}})
        r.raise_for_status()
        return r.json()
