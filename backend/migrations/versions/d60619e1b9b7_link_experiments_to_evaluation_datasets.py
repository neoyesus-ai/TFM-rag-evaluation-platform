"""link experiments to evaluation datasets

Revision ID: d60619e1b9b7
Revises: 1e99612cdeff
Create Date: 2026-07-15 12:20:19.073869
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa



revision: str = 'd60619e1b9b7'
down_revision: str | Sequence[str] | None = '1e99612cdeff'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Aplicar la migración."""
    pass


def downgrade() -> None:
    """Revertir la migración."""
    pass
