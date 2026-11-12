from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "b7e2d4f8a913"
down_revision: str | Sequence[str] | None = "a1f3c9d2e7b4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "profile_videos",
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("video_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["video_id"], ["videos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("profile_id", "video_id"),
    )
    op.create_index("ix_profile_videos_video_id", "profile_videos", ["video_id"])
    op.create_table(
        "profile_subscriptions",
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("channel_id", sa.Text(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["channel_id"], ["channels.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("profile_id", "channel_id"),
    )
    op.drop_column("channels", "subscribed")
    op.drop_column("channels", "subscription_rank")
    op.execute("DELETE FROM app_settings WHERE key = 'subscriptions_synced_at'")


def downgrade() -> None:
    op.add_column("channels", sa.Column("subscription_rank", sa.Integer(), nullable=True))
    op.add_column(
        "channels",
        sa.Column("subscribed", sa.Boolean(), server_default="false", nullable=False),
    )
    op.drop_table("profile_subscriptions")
    op.drop_index("ix_profile_videos_video_id", "profile_videos")
    op.drop_table("profile_videos")
