"""Helpers for resolving project root paths."""

from pathlib import Path

ROOT = Path(__file__).resolve()

while ROOT != ROOT.parent:
    if (ROOT / "pyproject.toml").exists():
        break
    ROOT = ROOT.parent
