"""add identity invites table

Revision ID: 3476a4bd238c
Revises: 009
Create Date: 2026-07-30 23:07:52.357523

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '3476a4bd238c'
down_revision: str | None = '009'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'invites',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('invited_by_id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column(
            'pre_filled_data', postgresql.JSON(astext_type=sa.Text()), nullable=True
        ),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['invited_by_id'], ['identity.users.id']),
        sa.ForeignKeyConstraint(['organization_id'], ['identity.organizations.id']),
        sa.PrimaryKeyConstraint('id'),
        schema='identity',
    )
    op.create_index(
        'ix_identity_invites_email', 'invites', ['email'],
        unique=False, schema='identity',
    )
    op.create_index(
        'ix_identity_invites_organization_id',
        'invites',
        ['organization_id'],
        unique=False,
        schema='identity',
    )


def downgrade() -> None:
    op.drop_index(
        'ix_identity_invites_organization_id', table_name='invites', schema='identity'
    )
    op.drop_index('ix_identity_invites_email', table_name='invites', schema='identity')
    op.drop_table('invites', schema='identity')
