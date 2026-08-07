"""set plan default to pro and backfill existing orgs

Revision ID: d5011bbf9670
Revises: acab936a66c1
Create Date: 2026-08-04 17:30:08.423559

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5011bbf9670'
down_revision: Union[str, None] = 'acab936a66c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE identity.organizations SET plan = 'pro'")
    op.alter_column(
        "organizations",
        "plan",
        server_default="pro",
        schema="identity",
    )


def downgrade() -> None:
    op.alter_column(
        "organizations",
        "plan",
        server_default="free",
        schema="identity",
    )
