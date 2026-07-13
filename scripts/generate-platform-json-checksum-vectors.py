"""Generate lossless structured-JSON checksum vectors from Python's JSON runtime."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import typer

app = typer.Typer(add_completion=False)
OUTPUT = Path(__file__).parent.parent / "src/lib/platform-json-checksum-vectors.json"


def _checksum(value: object) -> str:
    canonical = json.dumps(value, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


@app.command()
def generate(output: Path = OUTPUT) -> None:
    """Write Platform-compatible checksums for raw JSON projection values."""
    cases = (
        (
            "nested-unsafe-and-arbitrary-integers",
            r'{"outer":{"positive":9007199254740993,"negative":-9007199254740993,"huge":1234567890123456789012345678901234567890}}',
        ),
        (
            "mixed-fractional-and-exponent",
            r'{"values":[1e0,1.25e-5,-0.0,1e16,1.234e16]}',
        ),
        (
            "escaped-unicode-keys-and-strings",
            r'{"\ue000":"\ud834\udd1e","\ud800\udc00":"snowman: \u2603","escaped":"line\\nbreak\\t\\\"\\\\"}',
        ),
        (
            "nested-arrays-and-objects",
            r'{"array":[{"n":9007199254740993},[true,null,{"fraction":0.0000123}]]}',
        ),
        # Python json.loads and PostgreSQL JSONB both use the final duplicate
        # key. JSONB stores only that normalized value before export.
        ("duplicate-key-last-wins", r'{"duplicate":1,"duplicate":9007199254740993}'),
    )
    payload = [
        {
            "name": name,
            "json": raw,
            "expected": _checksum([{"config_json": json.loads(raw)}]),
        }
        for name, raw in cases
    ]
    output.write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    app()
