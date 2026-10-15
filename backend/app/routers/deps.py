from typing import Annotated

from fastapi import Query

# Validated by FastAPI before any route code runs: out-of-range values return 422.
Limit = Annotated[int, Query(ge=1, le=100, description="Page size (1-100).")]
Offset = Annotated[int, Query(ge=0, description="Number of rows to skip.")]