from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "c4a9e1b6d2f7"
down_revision: str | Sequence[str] | None = "b7e2d4f8a913"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("cookies_valid", sa.Boolean(), nullable=True))
    op.add_column(
        "profiles", sa.Column("cookies_checked_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("profiles", "cookies_checked_at")
    op.drop_column("profiles", "cookies_valid")
