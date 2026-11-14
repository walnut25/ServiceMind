"""Minimal HS256 JWT helpers (no external dependency).

Used to build deliberately expired / tampered / forged tokens so the API can
be tested around its real token validation instead of mocking it away.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any


def b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def b64url_decode(segment: str) -> bytes:
    padding = "=" * (-len(segment) % 4)
    return base64.urlsafe_b64decode(segment + padding)


def decode_payload(token: str) -> dict[str, Any]:
    parts = token.split(".")
    assert len(parts) == 3, f"not a JWS compact token: {token[:40]}..."
    return json.loads(b64url_decode(parts[1]))


def sign(payload: dict[str, Any], secret: str, *, algorithm: str = "HS256") -> str:
    header = {"alg": algorithm, "typ": "JWT"}
    header_seg = b64url_encode(json.dumps(header, separators=(",", ":")).encode())
    payload_seg = b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    signing_input = f"{header_seg}.{payload_seg}".encode()
    signature = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    return f"{header_seg}.{payload_seg}.{b64url_encode(signature)}"


def build_token(
    *,
    secret: str,
    subject: str,
    scope: str,
    issuer: str = "service-mind",
    ttl_seconds: int = 1800,
    issued_at_offset: int = 0,
) -> str:
    now = int(time.time()) + issued_at_offset
    payload = {
        "iss": issuer,
        "sub": subject,
        "scope": scope,
        "iat": now,
        "exp": now + ttl_seconds,
    }
    return sign(payload, secret)


def tamper_signature(token: str) -> str:
    """Corrupt the signature deterministically.

    Flipping the *last* base64 character is not enough: the final character of
    a 43-char base64url signature only carries 2 significant bits, so several
    characters decode to the same signature bytes. Flip the first byte instead.
    """
    header, payload, signature = token.split(".")
    raw = bytearray(b64url_decode(signature))
    raw[0] ^= 0xFF
    return f"{header}.{payload}.{b64url_encode(bytes(raw))}"
