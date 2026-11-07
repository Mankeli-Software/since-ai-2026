"""Gen-UI components (plan §4.4). One component per `<name>.py`; nothing to register by hand.

The `UIBlock` discriminated union is built at import time from the **sorted** submodules of this
package (modules starting with `_` are skipped). Each submodule defines exactly one
`UIBlockBase` subclass whose `type` default is the module name.
"""

import importlib
import pkgutil
from typing import TYPE_CHECKING, Annotated, Union

from pydantic import Field, TypeAdapter

from app.schemas.ui._base import UIBlockBase, UIKind


def _discover() -> list[type[UIBlockBase]]:
    models: list[type[UIBlockBase]] = []
    names = sorted(m.name for m in pkgutil.iter_modules(__path__) if not m.name.startswith("_"))
    for name in names:
        module = importlib.import_module(f"{__name__}.{name}")
        found = [
            obj
            for obj in vars(module).values()
            if isinstance(obj, type)
            and issubclass(obj, UIBlockBase)
            and obj is not UIBlockBase
            and obj.__module__ == module.__name__
        ]
        if len(found) != 1:
            raise RuntimeError(f"schemas/ui/{name}.py must define exactly one UIBlockBase model")
        model = found[0]
        if model.model_fields["type"].default != name:
            raise RuntimeError(f"schemas/ui/{name}.py: `type` must default to {name!r}")
        models.append(model)
    return models


UI_BLOCK_MODELS: tuple[type[UIBlockBase], ...] = tuple(_discover())

if TYPE_CHECKING:
    UIBlock = UIBlockBase
else:
    UIBlock = Annotated[Union[UI_BLOCK_MODELS], Field(discriminator="type")]  # noqa: UP007

UIBlockAdapter: TypeAdapter = TypeAdapter(UIBlock)

__all__ = ["UI_BLOCK_MODELS", "UIBlock", "UIBlockAdapter", "UIBlockBase", "UIKind"]
