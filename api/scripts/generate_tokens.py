#!/usr/bin/env python3
"""Generate bearer tokens for principals."""

import secrets
import hashlib

def main():
    principals = ["mark", "claude", "codex_a", "codex_b", "codex_c", "sum-cli", "ci_runner", "readonly"]
    
    print("# Bearer tokens for principals")
    print("# Store these securely - they cannot be recovered!")
    print()
    
    for principal in principals:
        token = f"opslog_{principal}_{secrets.token_hex(16)}"
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        print(f"# {principal}")
        print(f"# Token: {token}")
        print(f"# Hash:  {token_hash}")
        print()

if __name__ == "__main__":
    main()
