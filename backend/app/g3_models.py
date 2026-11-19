"""Shared candidate labels, regions and season definitions for G3."""

from typing import Annotated

from pydantic import Field

from .monthly_models import ClosedModel, Finite

Label = Annotated[str, Field(pattern=r"^[A-Za-z][A-Za-z0-9_-]{0,63}$")]
MonthNumber = Annotated[int, Field(strict=True, ge=1, le=12)]
Seasons = Annotated[
    dict[Label, Annotated[list[MonthNumber], Field(min_length=1, max_length=12)]],
    Field(min_length=1, max_length=12),
]


class G3Region(ClosedModel):
    id: Label
    name: Annotated[str, Field(pattern=r"^[\w .-]{1,80}$")]
    longitude: Annotated[Finite, Field(ge=-180, le=180)]
    latitude: Annotated[Finite, Field(ge=-90, le=90)]
