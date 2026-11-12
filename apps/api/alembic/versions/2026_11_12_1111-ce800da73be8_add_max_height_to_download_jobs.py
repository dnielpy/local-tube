from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "ce800da73be8"
down_revision: str | Sequence[str] | None = "8588c4c03e83"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("download_jobs", sa.Column("max_height", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("download_jobs", "max_height")
