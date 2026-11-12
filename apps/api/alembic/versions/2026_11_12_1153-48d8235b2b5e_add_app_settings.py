from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "48d8235b2b5e"
down_revision: str | Sequence[str] | None = "ce800da73be8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "app_settings",
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("key"),
    )


def downgrade() -> None:
    op.drop_table("app_settings")
