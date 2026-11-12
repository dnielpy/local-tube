from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d1e61219dbf1"
down_revision: str | Sequence[str] | None = "5d40b459ad9a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("channels", sa.Column("subscription_rank", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("channels", "subscription_rank")
