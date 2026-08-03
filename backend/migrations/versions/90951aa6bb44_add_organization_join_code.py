"""add_organization_join_code

Revision ID: 90951aa6bb44
Revises: 3476a4bd238c
Create Date: 2026-08-03 15:12:30.090775

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '90951aa6bb44'
down_revision: Union[str, None] = '3476a4bd238c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column(
        'organizations',
        sa.Column('join_code', sa.String(length=10), nullable=True),
        schema='identity',
    )
    op.create_index(
        'ix_identity_organizations_join_code',
        'organizations',
        ['join_code'],
        unique=False,
        schema='identity',
    )
    op.create_unique_constraint(
        'uq_organizations_join_code',
        'organizations',
        ['join_code'],
        schema='identity',
    )
    # Generate join codes for any existing orgs that don't have one yet.
    alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    op.execute(
        f"""
        UPDATE identity.organizations
        SET join_code = (
            SELECT string_agg(substr('{alphabet}', floor(random() * {len(alphabet)})::int + 1, 1), '')
            FROM generate_series(1, 6)
        )
        WHERE join_code IS NULL
        """
    )


def downgrade() -> None:
    op.drop_constraint('uq_organizations_join_code', 'organizations', schema='identity', type_='unique')
    op.drop_index('ix_identity_organizations_join_code', table_name='organizations', schema='identity')
    op.drop_column('organizations', 'join_code', schema='identity')
