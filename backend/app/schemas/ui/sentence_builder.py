from typing import ClassVar, Literal

from pydantic import BaseModel, Field

from app.schemas.ui._base import UIBlockBase, UIKind


class SentenceTokenOption(BaseModel):
    id: str = Field(max_length=64)
    label: str = Field(max_length=40)


class SentenceToken(BaseModel):
    id: str = Field(max_length=32, pattern=r"^\w+$", description="Matches a `{id}` slot")
    placeholder: str = Field(max_length=40, description="Pill text while unfilled")
    options: list[SentenceTokenOption] = Field(min_length=2, max_length=8)
    value: str | None = Field(default=None, max_length=64, description="Prefilled option id")


class SentenceBuilder(UIBlockBase):
    """Ask several short background facts as one sentence with tappable word pills.

    `template` is the sentence with a `{token_id}` slot per token. The resume value is a dict of
    token id -> picked option id.
    """

    kind: ClassVar[UIKind] = "ui_input"

    type: Literal["sentence_builder"] = "sentence_builder"
    prompt: str = Field(max_length=200)
    template: str = Field(max_length=300)
    tokens: list[SentenceToken] = Field(min_length=1, max_length=6)
