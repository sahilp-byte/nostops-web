"""Cloudflare R2 storage service (S3-compatible API, boto3) for the NOSTOPS intro-video library.

Server-only. Credentials come from the environment (the secure key settings) and are never logged,
returned or sent to the browser:

  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME   (required)
  R2_ENDPOINT_URL      optional — defaults to https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
  R2_PUBLIC_BASE_URL   optional — a verified public custom domain for PUBLIC videos

The S3 API endpoint is never handed to a browser as a plain URL: viewers only ever receive a
short-lived presigned GET link (or, once configured, the verified public domain).

boto3 is synchronous; callers run these functions with asyncio.to_thread. Every storage failure is
mapped to an R2Error with a safe message (no keys, no signed URLs, no stack traces).
"""
import logging
import os
import threading

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger("r2_storage")

PREFIX = "intro-videos/"
REQUIRED = ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME")


class R2Error(Exception):
    def __init__(self, code: str, message: str, status: int):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


def missing_settings() -> list[str]:
    """Names (never values) of required settings that are not set."""
    return [k for k in REQUIRED if not (os.environ.get(k) or "").strip()]


def bucket() -> str:
    return (os.environ.get("R2_BUCKET_NAME") or "").strip()


def public_base_url() -> str:
    return (os.environ.get("R2_PUBLIC_BASE_URL") or "").strip().rstrip("/")


_lock = threading.Lock()
_client = None
_client_sig = None


def _endpoint() -> str:
    custom = (os.environ.get("R2_ENDPOINT_URL") or "").strip().rstrip("/")
    return custom or f"https://{os.environ['R2_ACCOUNT_ID'].strip()}.r2.cloudflarestorage.com"


def _s3():
    global _client, _client_sig
    missing = missing_settings()
    if missing:
        raise R2Error("not_configured", "Video storage is not configured yet.", 503)
    sig = (_endpoint(), os.environ["R2_ACCESS_KEY_ID"].strip(), os.environ["R2_SECRET_ACCESS_KEY"].strip())
    with _lock:
        if _client is None or _client_sig != sig:
            _client = boto3.client(
                "s3",
                endpoint_url=sig[0],
                region_name="auto",
                aws_access_key_id=sig[1],
                aws_secret_access_key=sig[2],
                config=Config(signature_version="s3v4", retries={"max_attempts": 3, "mode": "standard"},
                              connect_timeout=8, read_timeout=30),
            )
            _client_sig = sig
        return _client


def _map(e: Exception) -> R2Error:
    if isinstance(e, R2Error):
        return e
    if isinstance(e, ClientError):
        code = str(e.response.get("Error", {}).get("Code", ""))
        status = int(e.response.get("ResponseMetadata", {}).get("HTTPStatusCode") or 0)
        if code in ("NoSuchKey", "404", "NotFound") or (status == 404 and code != "NoSuchBucket"):
            return R2Error("not_found", "The video file was not found in storage.", 404)
        if code == "NoSuchBucket":
            return R2Error("bucket_missing", "The storage bucket could not be found.", 502)
        if code in ("AccessDenied", "403", "InvalidAccessKeyId", "SignatureDoesNotMatch", "Unauthorized") or status in (401, 403):
            return R2Error("access_denied", "Video storage rejected the configured credentials.", 502)
        if code == "InvalidRange":
            return R2Error("invalid_range", "The requested part of the file is out of range.", 416)
        log.warning("R2 client error %s (%s)", code or "unknown", status)
        return R2Error("unavailable", "Video storage is unavailable right now.", 503)
    if isinstance(e, BotoCoreError):
        log.warning("R2 connection problem: %s", type(e).__name__)
        return R2Error("unavailable", "Video storage is unavailable right now.", 503)
    log.warning("R2 unexpected error: %s", type(e).__name__)
    return R2Error("unavailable", "Video storage is unavailable right now.", 503)


def _call(fn, **kw):
    try:
        return fn(**kw)
    except Exception as e:  # noqa: BLE001 — every failure becomes a safe R2Error
        raise _map(e) from None


def check() -> dict:
    """Connectivity check: one cheap list call against the configured bucket."""
    r = _call(_s3().list_objects_v2, Bucket=bucket(), MaxKeys=1)
    return {"ok": True, "bucket": bucket(), "has_objects": bool(r.get("KeyCount"))}


def put(key: str, body: bytes, content_type: str, metadata: dict[str, str]) -> None:
    _call(_s3().put_object, Bucket=bucket(), Key=key, Body=body, ContentType=content_type,
          ContentDisposition="inline", CacheControl="private, max-age=3600", Metadata=metadata)


def head(key: str) -> dict:
    h = _call(_s3().head_object, Bucket=bucket(), Key=key)
    lm = h.get("LastModified")
    return {"size": int(h.get("ContentLength") or 0), "content_type": h.get("ContentType") or "",
            "etag": (h.get("ETag") or "").strip('"'), "last_modified": lm.isoformat() if lm else None}


def read_start(key: str, length: int = 65536) -> bytes:
    """First bytes of an object (one ranged GET) — used to check an existing file really is a video."""
    r = _call(_s3().get_object, Bucket=bucket(), Key=key, Range=f"bytes=0-{max(1, length) - 1}")
    try:
        return r["Body"].read()
    except Exception as e:  # noqa: BLE001
        raise _map(e) from None


def list_objects(limit: int = 1000) -> tuple[list[dict], bool]:
    """Every object in the bucket (read-only), newest first; returns (rows, truncated)."""
    s3, rows, token, truncated = _s3(), [], None, False
    while len(rows) < limit:
        kw = {"Bucket": bucket(), "MaxKeys": min(1000, limit - len(rows))}
        if token:
            kw["ContinuationToken"] = token
        page = _call(s3.list_objects_v2, **kw)
        for o in page.get("Contents", []) or []:
            lm = o.get("LastModified")
            rows.append({"key": o["Key"], "size": int(o.get("Size") or 0),
                         "last_modified": lm.isoformat() if lm else None})
        token = page.get("NextContinuationToken")
        if not page.get("IsTruncated") or not token:
            break
    else:
        truncated = True
    rows.sort(key=lambda r: r["last_modified"] or "", reverse=True)
    return rows, truncated


def presign_get(key: str, ttl: int) -> str:
    return _call(_s3().generate_presigned_url, ClientMethod="get_object",
                 Params={"Bucket": bucket(), "Key": key}, ExpiresIn=ttl)


def delete(key: str) -> None:
    if not key.startswith(PREFIX):  # the app may only ever delete what it uploaded itself
        raise R2Error("forbidden", "Only videos uploaded through NOSTOPS can be deleted.", 403)
    _call(_s3().delete_object, Bucket=bucket(), Key=key)
