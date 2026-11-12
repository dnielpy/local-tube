from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d8f3b2a5c1e9"
down_revision: str | Sequence[str] | None = "c4a9e1b6d2f7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "watch_history",
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("video_id", sa.Uuid(), nullable=False),
        sa.Column("watched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("position", sa.Float(), nullable=False),
        sa.Column("duration", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["video_id"], ["videos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("profile_id", "video_id"),
    )
    op.create_index("ix_watch_history_watched_at", "watch_history", ["watched_at"])
    op.create_table(
        "playlists",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column(
            "kind",
            sa.Enum("watch_later", "liked", "custom", name="playlist_kind"),
            nullable=False,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_playlists_profile_id", "playlists", ["profile_id"])
    op.create_table(
        "playlist_items",
        sa.Column("playlist_id", sa.Uuid(), nullable=False),
        sa.Column("video_id", sa.Uuid(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "added_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(["playlist_id"], ["playlists.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["video_id"], ["videos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("playlist_id", "video_id"),
    )
    op.create_index("ix_playlist_items_video_id", "playlist_items", ["video_id"])


def downgrade() -> None:
    op.drop_index("ix_playlist_items_video_id", "playlist_items")
    op.drop_table("playlist_items")
    op.drop_index("ix_playlists_profile_id", "playlists")
    op.drop_table("playlists")
    sa.Enum(name="playlist_kind").drop(op.get_bind())
    op.drop_index("ix_watch_history_watched_at", "watch_history")
    op.drop_table("watch_history")
