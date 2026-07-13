"""Generate the checked-in Python float spelling contract for Unitbench."""

from __future__ import annotations

import json
import math
import random
import struct
from pathlib import Path

import typer

app = typer.Typer(add_completion=False)
OUTPUT = Path(__file__).parent.parent / "src/lib/platform-numeric-json-vectors.json"


def _bits(value: float) -> str:
    return f"0x{struct.unpack('>Q', struct.pack('>d', value))[0]:016x}"


def _input(value: float) -> str:
    return "-0.0" if math.copysign(1.0, value) < 0 and value == 0 else repr(value)


def _add(values: list[tuple[str, float]], name: str, value: float) -> None:
    if math.isfinite(value):
        values.append((name, value))


@app.command()
def generate(output: Path = OUTPUT) -> None:
    """Write deterministic finite IEEE-754 vectors using Python json.dumps."""
    values: list[tuple[str, float]] = []
    _add(values, "positive-zero", 0.0)
    _add(values, "negative-zero", -0.0)
    for boundary in (1e-4, 1e16):
        for direction, value in (
            ("below", math.nextafter(boundary, -math.inf)),
            ("exact", boundary),
            ("above", math.nextafter(boundary, math.inf)),
        ):
            _add(values, f"threshold-{boundary:g}-{direction}", value)
            _add(values, f"threshold-negative-{boundary:g}-{direction}", -value)
    for exponent in (-324, -323, -308, -100, -16, -5, -4, -3, -1, 0, 1, 15, 16, 17, 100, 308):
        value = 10.0**exponent
        _add(values, f"power-ten-{exponent}", value)
        _add(values, f"power-ten-negative-{exponent}", -value)
    for name, value in (
        ("min-subnormal", math.ulp(0.0)),
        ("max-subnormal", math.nextafter(sys_float_min := float.fromhex("0x1.0p-1022"), 0.0)),
        ("min-normal", sys_float_min),
        ("max-finite", sys_float_max := float.fromhex("0x1.fffffffffffffp+1023")),
        ("one-neighbor-down", math.nextafter(1.0, 0.0)),
        ("one-neighbor-up", math.nextafter(1.0, math.inf)),
        ("half-ulp", 2.0**-53),
        ("one-and-half-ulp", 1.0 + 3.0 * 2.0**-53),
    ):
        _add(values, name, value)
        _add(values, f"negative-{name}", -value)
    generator = random.Random(0xD15EA5E)
    while sum(name.startswith("random-") for name, _value in values) < 512:
        bits = generator.getrandbits(64)
        value = struct.unpack(">d", struct.pack(">Q", bits))[0]
        _add(values, f"random-{bits:016x}", value)
    payload = [
        {
            "name": name,
            "bits": _bits(value),
            "input": _input(value),
            "expected": json.dumps(value, separators=(",", ":")),
        }
        for name, value in values
    ]
    output.write_text(json.dumps(payload, indent=2) + "\n")


if __name__ == "__main__":
    app()
