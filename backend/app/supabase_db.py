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
