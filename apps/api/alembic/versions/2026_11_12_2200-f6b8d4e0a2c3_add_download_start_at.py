from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f6b8d4e0a2c3"
down_revision: str | Sequence[str] | None = "e5a7c3d9f1b2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "download_jobs", sa.Column("start_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("download_jobs", "start_at")
