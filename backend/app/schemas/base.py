from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    """Base for every API schema: camelCase JSON, snake_case in Python.

    These are Pydantic schemas (API contract). They are separate from the SQLAlchemy models
    in app/models (database storage) on purpose; see README "Models vs schemas".
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)