"""add application users

Revision ID: f4704ff1422c
Revises: d60619e1b9b7
Create Date: 2026-07-15 22:15:43.969437
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa



revision: str = 'f4704ff1422c'
down_revision: str | Sequence[str] | None = 'd60619e1b9b7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Aplicar la migración."""
    pass


def downgrade() -> None:
    """Revertir la migración."""
    pass
