from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "5d40b459ad9a"
down_revision: str | Sequence[str] | None = "48d8235b2b5e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "channels",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("handle", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("subscriber_count", sa.BigInteger(), nullable=True),
        sa.Column("avatar_path", sa.Text(), nullable=True),
        sa.Column("avatar_source_url", sa.Text(), nullable=True),
        sa.Column("banner_path", sa.Text(), nullable=True),
        sa.Column("banner_source_url", sa.Text(), nullable=True),
        sa.Column("subscribed", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("videos_fetched_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "channel_videos",
        sa.Column("youtube_id", sa.Text(), nullable=False),
        sa.Column("channel_id", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("view_count", sa.BigInteger(), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("thumbnail_path", sa.Text(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["channel_id"], ["channels.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("youtube_id"),
    )
    op.create_index(
        op.f("ix_channel_videos_channel_id"), "channel_videos", ["channel_id"], unique=False
    )
    op.add_column("download_jobs", sa.Column("youtube_id", sa.Text(), nullable=True))
    op.create_index(
        op.f("ix_download_jobs_youtube_id"), "download_jobs", ["youtube_id"], unique=False
    )
    op.add_column("videos", sa.Column("channel_id", sa.Text(), nullable=True))
    op.create_index(op.f("ix_videos_channel_id"), "videos", ["channel_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_videos_channel_id"), table_name="videos")
    op.drop_column("videos", "channel_id")
    op.drop_index(op.f("ix_download_jobs_youtube_id"), table_name="download_jobs")
    op.drop_column("download_jobs", "youtube_id")
    op.drop_index(op.f("ix_channel_videos_channel_id"), table_name="channel_videos")
    op.drop_table("channel_videos")
    op.drop_table("channels")
