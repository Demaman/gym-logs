"""add wellhub tables

Revision ID: i1j2k3l4m5n6
Revises: h3i4j5k6l7m8
Create Date: 2026-09-04 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "i1j2k3l4m5n6"
down_revision: str | None = "h3i4j5k6l7m8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "wellhub_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            UUID(as_uuid=True),
            sa.ForeignKey("identity.organizations.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("wellhub_gym_id", sa.String(64), nullable=False),
        sa.Column("bearer_token", sa.String(512), nullable=False),
        sa.Column("webhook_secret", sa.String(256), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        schema="identity",
    )
    op.create_index(
        "ix_wellhub_configs_organization_id",
        "wellhub_configs",
        ["organization_id"],
        schema="identity",
    )
    op.create_index(
        "ix_wellhub_configs_wellhub_gym_id",
        "wellhub_configs",
        ["wellhub_gym_id"],
        schema="identity",
    )

    op.create_table(
        "wellhub_members",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("identity.users.id"),
            nullable=False,
        ),
        sa.Column("gympass_id", sa.String(16), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint(
            "organization_id", "gympass_id", name="uq_wellhub_member_gympass"
        ),
        sa.UniqueConstraint(
            "organization_id", "user_id", name="uq_wellhub_member_user"
        ),
        schema="identity",
    )
    op.create_index(
        "ix_wellhub_members_organization_id",
        "wellhub_members",
        ["organization_id"],
        schema="identity",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_wellhub_members_organization_id",
        table_name="wellhub_members",
        schema="identity",
    )
    op.drop_table("wellhub_members", schema="identity")

    op.drop_index(
        "ix_wellhub_configs_wellhub_gym_id",
        table_name="wellhub_configs",
        schema="identity",
    )
    op.drop_index(
        "ix_wellhub_configs_organization_id",
        table_name="wellhub_configs",
        schema="identity",
    )
    op.drop_table("wellhub_configs", schema="identity")
