"""initial: create schemas and identity tables

Revision ID: 001
Revises:
Create Date: 2026-06-30

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create all module schemas up front
    op.execute("CREATE SCHEMA IF NOT EXISTS identity")
    op.execute("CREATE SCHEMA IF NOT EXISTS training")
    op.execute("CREATE SCHEMA IF NOT EXISTS logs")
    op.execute("CREATE SCHEMA IF NOT EXISTS analytics")

    op.create_table(
        "organizations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        schema="identity",
    )

    # sa.Enum with create_type=True (default) emits CREATE TYPE before CREATE TABLE.
    # Do NOT also call op.execute("CREATE TYPE ...") — that would duplicate it.
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column(
            "role",
            sa.Enum(
                "athlete",
                "trainer",
                "gym_admin",
                name="user_role",
                schema="identity",
            ),
            nullable=False,
        ),
        sa.Column("hashed_password", sa.String, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["identity.organizations.id"],
        ),
        schema="identity",
    )
    op.create_index(
        "ix_identity_users_email", "users", ["email"], unique=True, schema="identity"
    )
    op.create_index(
        "ix_identity_users_org", "users", ["organization_id"], schema="identity"
    )

    op.create_table(
        "memberships",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", UUID(as_uuid=True), nullable=False),
        sa.Column("trainer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("athlete_id", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["identity.organizations.id"]),
        sa.ForeignKeyConstraint(["trainer_id"], ["identity.users.id"]),
        sa.ForeignKeyConstraint(["athlete_id"], ["identity.users.id"]),
        sa.UniqueConstraint("trainer_id", "athlete_id", name="uq_membership"),
        schema="identity",
    )
    op.create_index(
        "ix_identity_memberships_org",
        "memberships",
        ["organization_id"],
        schema="identity",
    )


def downgrade() -> None:
    op.drop_table("memberships", schema="identity")
    op.drop_index("ix_identity_users_org", table_name="users", schema="identity")
    op.drop_index("ix_identity_users_email", table_name="users", schema="identity")
    # drop_table with an Enum column emits DROP TYPE automatically (create_type default)
    op.drop_table("users", schema="identity")
    op.drop_table("organizations", schema="identity")
    op.execute("DROP SCHEMA IF EXISTS analytics")
    op.execute("DROP SCHEMA IF EXISTS logs")
    op.execute("DROP SCHEMA IF EXISTS training")
    op.execute("DROP SCHEMA IF EXISTS identity")
