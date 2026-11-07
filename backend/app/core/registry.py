"""Sorted autodiscovery: add a file, never edit a shared registry (AGENTS.md §1.3 rule 3).

`discover("app.api.routes")` imports every non-underscore submodule in sorted name order, so the
result (route order, tool order, OpenAPI output) is deterministic across machines.
"""

import importlib
import pkgutil
from types import ModuleType


def discover(package: str) -> list[ModuleType]:
    pkg = importlib.import_module(package)
    paths = getattr(pkg, "__path__", None)
    if paths is None:
        raise ValueError(f"{package} is not a package")
    names = sorted(m.name for m in pkgutil.iter_modules(paths) if not m.name.startswith("_"))
    return [importlib.import_module(f"{package}.{name}") for name in names]
