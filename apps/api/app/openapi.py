"""Print the OpenAPI schema, used to generate the web client types."""

import json

from app.main import app

if __name__ == "__main__":
    print(json.dumps(app.openapi(), indent=2))
