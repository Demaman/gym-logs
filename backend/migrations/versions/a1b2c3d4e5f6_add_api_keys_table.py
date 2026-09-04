"""add api_keys table

Revision ID: a1b2c3d4e5f6
Revises: db573847af55
Create Date: 2026-08-25 00:00:00.000000

"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "cf24d326d540"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "api_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("identity.organizations.id"),
            nullable=False,
        ),
        sa.Column(
            "created_by_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("identity.users.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("key_prefix", sa.String(16), nullable=False),
        sa.Column("key_hash", sa.String(64), nullable=False, unique=True),
        sa.Column(
            "scopes",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        schema="identity",
    )
    op.create_index(
        "ix_identity_api_keys_organization_id",
        "api_keys",
        ["organization_id"],
        schema="identity",
    )
    op.create_index(
        "ix_identity_api_keys_key_hash",
        "api_keys",
        ["key_hash"],
        unique=True,
        schema="identity",
    )


def downgrade() -> None:
    op.drop_index("ix_identity_api_keys_key_hash", table_name="api_keys", schema="identity")
    op.drop_index("ix_identity_api_keys_organization_id", table_name="api_keys", schema="identity")
    op.drop_table("api_keys", schema="identity")
