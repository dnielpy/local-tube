from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "e5a7c3d9f1b2"
down_revision: str | Sequence[str] | None = "d8f3b2a5c1e9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "auto_download_channels",
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("channel_id", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["channel_id"], ["channels.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("profile_id", "channel_id"),
    )


def downgrade() -> None:
    op.drop_table("auto_download_channels")
