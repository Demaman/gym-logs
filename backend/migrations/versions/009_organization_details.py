"""add detail fields to organizations

Revision ID: 009
Revises: 008
Create Date: 2026-07-25

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "009"
down_revision: str | None = "008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("organizations", sa.Column("cnpj", sa.String(18), nullable=True), schema="identity")
    op.add_column("organizations", sa.Column("phone", sa.String(20), nullable=True), schema="identity")
    op.add_column("organizations", sa.Column("contact_email", sa.String(255), nullable=True), schema="identity")
    op.add_column("organizations", sa.Column("address_street", sa.String(255), nullable=True), schema="identity")
    op.add_column("organizations", sa.Column("address_city", sa.String(100), nullable=True), schema="identity")
    op.add_column("organizations", sa.Column("address_state", sa.String(50), nullable=True), schema="identity")
    op.add_column("organizations", sa.Column("address_zip", sa.String(10), nullable=True), schema="identity")
    op.add_column("organizations", sa.Column("website", sa.String(255), nullable=True), schema="identity")


def downgrade() -> None:
    for col in ["website", "address_zip", "address_state", "address_city", "address_street", "contact_email", "phone", "cnpj"]:
        op.drop_column("organizations", col, schema="identity")
