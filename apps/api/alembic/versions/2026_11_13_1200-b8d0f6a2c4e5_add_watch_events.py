from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "b8d0f6a2c4e5"
down_revision: str | Sequence[str] | None = "a7c9e5f1b3d4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "watch_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("profile_id", sa.Uuid(), nullable=False),
        sa.Column("video_id", sa.Uuid(), nullable=False),
        sa.Column("seconds", sa.Float(), nullable=False),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["profile_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["video_id"], ["videos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_watch_events_profile_id", "watch_events", ["profile_id"])
    op.create_index("ix_watch_events_at", "watch_events", ["at"])


def downgrade() -> None:
    op.drop_index("ix_watch_events_at", table_name="watch_events")
    op.drop_index("ix_watch_events_profile_id", table_name="watch_events")
    op.drop_table("watch_events")
