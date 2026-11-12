from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a1f3c9d2e7b4"
down_revision: str | Sequence[str] | None = "0c6289947912"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "profiles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("pin_hash", sa.Text(), nullable=False),
        sa.Column("status", sa.Enum("pending", "ready", name="profile_status"), nullable=False),
        sa.Column("avatar_path", sa.Text(), nullable=True),
        sa.Column("youtube_name", sa.Text(), nullable=True),
        sa.Column("signed_in_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.add_column("download_jobs", sa.Column("profile_id", sa.Uuid(), nullable=True))
    op.create_index("ix_download_jobs_profile_id", "download_jobs", ["profile_id"])
    op.create_foreign_key(
        "download_jobs_profile_id_fkey",
        "download_jobs",
        "profiles",
        ["profile_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("download_jobs_profile_id_fkey", "download_jobs", type_="foreignkey")
    op.drop_index("ix_download_jobs_profile_id", "download_jobs")
    op.drop_column("download_jobs", "profile_id")
    op.drop_table("profiles")
    sa.Enum(name="profile_status").drop(op.get_bind())
