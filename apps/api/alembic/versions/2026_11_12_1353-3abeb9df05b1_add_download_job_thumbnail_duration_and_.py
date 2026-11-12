from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "3abeb9df05b1"
down_revision: str | Sequence[str] | None = "d1e61219dbf1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("download_jobs", sa.Column("thumbnail_path", sa.Text(), nullable=True))
    op.add_column("download_jobs", sa.Column("duration_seconds", sa.Integer(), nullable=True))
    op.add_column("download_jobs", sa.Column("size_bytes", sa.BigInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column("download_jobs", "size_bytes")
    op.drop_column("download_jobs", "duration_seconds")
    op.drop_column("download_jobs", "thumbnail_path")
