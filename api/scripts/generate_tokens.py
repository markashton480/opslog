#!/usr/bin/env python3
"""Generate bearer tokens for principals."""

from __future__ import annotations

import hashlib
import secrets

PRINCIPALS = [
    "mark",
    "claude",
    "codex_a",
    "codex_b",
    "codex_c",
    "sum-cli",
    "ci_runner",
    "readonly",
]


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def main() -> None:
    print("# Bearer tokens for principals")
    print("# Store securely. Hashes are for DB insertion.")
    print()

    for principal in PRINCIPALS:
        token = f"opslog_{principal}_{secrets.token_hex(24)}"
        print(f"[{principal}]")
        print(f"token={token}")
        print(f"token_hash={hash_token(token)}")
        print()


if __name__ == "__main__":
    main()
