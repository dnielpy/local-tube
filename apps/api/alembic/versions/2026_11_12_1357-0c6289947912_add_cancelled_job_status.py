from collections.abc import Sequence

from alembic import op

revision: str = "0c6289947912"
down_revision: str | Sequence[str] | None = "3abeb9df05b1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'cancelled'")


def downgrade() -> None:
    op.execute("UPDATE download_jobs SET status = 'failed' WHERE status = 'cancelled'")
    op.execute("ALTER TYPE job_status RENAME TO job_status_old")
    op.execute(
        "CREATE TYPE job_status AS ENUM "
        "('queued', 'downloading', 'processing', 'completed', 'failed')"
    )
    op.execute(
        "ALTER TABLE download_jobs ALTER COLUMN status TYPE job_status "
        "USING status::text::job_status"
    )
    op.execute("DROP TYPE job_status_old")
