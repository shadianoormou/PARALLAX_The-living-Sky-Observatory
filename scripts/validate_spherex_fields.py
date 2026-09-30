#!/usr/bin/env python3
"""Run a repeatable live SPHEREx validation across three independent fields.

Usage:
    .venv/bin/python scripts/validate_spherex_fields.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.science.app.archive_validation import SpherexValidationField, validate_spherex_fields


FIELDS = [
    SpherexValidationField("southern-demo-field", 127.69444, -39.1776),
    SpherexValidationField("cosmos-check-field", 150.116, 2.205),
    SpherexValidationField("andromeda-check-field", 10.6847, 41.269),
]


if __name__ == "__main__":
    print(json.dumps(validate_spherex_fields(FIELDS), indent=2))
