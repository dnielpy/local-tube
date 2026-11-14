from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d0f2b8c4e6a7"
down_revision: str | Sequence[str] | None = "c9e1a7b3d5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "download_jobs",
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column("download_jobs", sa.Column("retry_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("download_jobs", sa.Column("format_id", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("download_jobs", "format_id")
    op.drop_column("download_jobs", "retry_at")
    op.drop_column("download_jobs", "attempts")
