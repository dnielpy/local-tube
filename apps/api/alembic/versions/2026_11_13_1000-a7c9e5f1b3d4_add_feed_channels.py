from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a7c9e5f1b3d4"
down_revision: str | Sequence[str] | None = "f6b8d4e0a2c3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "feed_channels",
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
    op.add_column("channel_videos", sa.Column("live_status", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("channel_videos", "live_status")
    op.drop_table("feed_channels")
