"""generalize wellhub tables to generic partner tables

Revision ID: j2k3l4m5n6o7
Revises: i1j2k3l4m5n6
Create Date: 2026-09-04 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "j2k3l4m5n6o7"
down_revision: str | None = "i1j2k3l4m5n6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ------------------------------------------------------------------ #
    # partner_configs (was wellhub_configs)                               #
    # ------------------------------------------------------------------ #

    # 1. Rename table
    op.rename_table("wellhub_configs", "partner_configs", schema="identity")

    # 2. Add platform column
    op.add_column(
        "partner_configs",
        sa.Column(
            "platform",
            sa.String(32),
            nullable=False,
            server_default="wellhub",
        ),
        schema="identity",
    )

    # 3. Add external_gym_id column
    op.add_column(
        "partner_configs",
        sa.Column(
            "external_gym_id",
            sa.String(64),
            nullable=False,
            server_default="",
        ),
        schema="identity",
    )

    # 4. Copy wellhub_gym_id → external_gym_id
    op.execute(
        "UPDATE identity.partner_configs SET external_gym_id = wellhub_gym_id"
    )

    # 5. Drop old auto-named unique constraint on organization_id
    #    PostgreSQL names it <table>_<col>_key; after rename the table part stays
    op.drop_constraint(
        "wellhub_configs_organization_id_key",
        "partner_configs",
        schema="identity",
    )

    # 6. Drop old indices
    op.drop_index(
        "ix_wellhub_configs_organization_id",
        table_name="partner_configs",
        schema="identity",
    )
    op.drop_index(
        "ix_wellhub_configs_wellhub_gym_id",
        table_name="partner_configs",
        schema="identity",
    )

    # 7. Drop old wellhub_gym_id column
    op.drop_column("partner_configs", "wellhub_gym_id", schema="identity")

    # 8. Remove server defaults now that data is populated
    op.execute(
        "ALTER TABLE identity.partner_configs "
        "ALTER COLUMN platform DROP DEFAULT"
    )
    op.execute(
        "ALTER TABLE identity.partner_configs "
        "ALTER COLUMN external_gym_id DROP DEFAULT"
    )

    # 9. Create new unique constraint: one config per platform per org
    op.create_unique_constraint(
        "uq_partner_configs_org_platform",
        "partner_configs",
        ["organization_id", "platform"],
        schema="identity",
    )

    # 10. Recreate indices
    op.create_index(
        "ix_partner_configs_organization_id",
        "partner_configs",
        ["organization_id"],
        schema="identity",
    )
    op.create_index(
        "ix_partner_configs_external_gym_id",
        "partner_configs",
        ["external_gym_id"],
        schema="identity",
    )

    # ------------------------------------------------------------------ #
    # partner_members (was wellhub_members)                               #
    # ------------------------------------------------------------------ #

    # 1. Rename table
    op.rename_table("wellhub_members", "partner_members", schema="identity")

    # 2. Add platform column
    op.add_column(
        "partner_members",
        sa.Column(
            "platform",
            sa.String(32),
            nullable=False,
            server_default="wellhub",
        ),
        schema="identity",
    )

    # 3. Add external_member_id column
    op.add_column(
        "partner_members",
        sa.Column(
            "external_member_id",
            sa.String(64),
            nullable=False,
            server_default="",
        ),
        schema="identity",
    )

    # 4. Copy gympass_id → external_member_id
    op.execute(
        "UPDATE identity.partner_members SET external_member_id = gympass_id"
    )

    # 5. Drop old unique constraints
    op.drop_constraint(
        "uq_wellhub_member_gympass",
        "partner_members",
        schema="identity",
    )
    op.drop_constraint(
        "uq_wellhub_member_user",
        "partner_members",
        schema="identity",
    )

    # 6. Drop old index
    op.drop_index(
        "ix_wellhub_members_organization_id",
        table_name="partner_members",
        schema="identity",
    )

    # 7. Drop old gympass_id column
    op.drop_column("partner_members", "gympass_id", schema="identity")

    # 8. Remove server defaults now that data is populated
    op.execute(
        "ALTER TABLE identity.partner_members "
        "ALTER COLUMN platform DROP DEFAULT"
    )
    op.execute(
        "ALTER TABLE identity.partner_members "
        "ALTER COLUMN external_member_id DROP DEFAULT"
    )

    # 9. Create new unique constraints (platform-aware)
    op.create_unique_constraint(
        "uq_partner_members_platform_external_id",
        "partner_members",
        ["organization_id", "platform", "external_member_id"],
        schema="identity",
    )
    op.create_unique_constraint(
        "uq_partner_members_platform_user",
        "partner_members",
        ["organization_id", "platform", "user_id"],
        schema="identity",
    )

    # 10. Recreate index
    op.create_index(
        "ix_partner_members_organization_id",
        "partner_members",
        ["organization_id"],
        schema="identity",
    )


def downgrade() -> None:
    # ------------------------------------------------------------------ #
    # Restore partner_members → wellhub_members                          #
    # ------------------------------------------------------------------ #

    op.drop_index(
        "ix_partner_members_organization_id",
        table_name="partner_members",
        schema="identity",
    )
    op.drop_constraint(
        "uq_partner_members_platform_user",
        "partner_members",
        schema="identity",
    )
    op.drop_constraint(
        "uq_partner_members_platform_external_id",
        "partner_members",
        schema="identity",
    )

    op.add_column(
        "partner_members",
        sa.Column("gympass_id", sa.String(16), nullable=False, server_default=""),
        schema="identity",
    )
    op.execute(
        "UPDATE identity.partner_members SET gympass_id = external_member_id"
    )
    op.execute(
        "ALTER TABLE identity.partner_members ALTER COLUMN gympass_id DROP DEFAULT"
    )

    op.drop_column("partner_members", "external_member_id", schema="identity")
    op.drop_column("partner_members", "platform", schema="identity")

    op.create_unique_constraint(
        "uq_wellhub_member_gympass",
        "partner_members",
        ["organization_id", "gympass_id"],
        schema="identity",
    )
    op.create_unique_constraint(
        "uq_wellhub_member_user",
        "partner_members",
        ["organization_id", "user_id"],
        schema="identity",
    )
    op.create_index(
        "ix_wellhub_members_organization_id",
        "partner_members",
        ["organization_id"],
        schema="identity",
    )

    op.rename_table("partner_members", "wellhub_members", schema="identity")

    # ------------------------------------------------------------------ #
    # Restore partner_configs → wellhub_configs                          #
    # ------------------------------------------------------------------ #

    op.drop_index(
        "ix_partner_configs_external_gym_id",
        table_name="partner_configs",
        schema="identity",
    )
    op.drop_index(
        "ix_partner_configs_organization_id",
        table_name="partner_configs",
        schema="identity",
    )
    op.drop_constraint(
        "uq_partner_configs_org_platform",
        "partner_configs",
        schema="identity",
    )

    op.add_column(
        "partner_configs",
        sa.Column("wellhub_gym_id", sa.String(64), nullable=False, server_default=""),
        schema="identity",
    )
    op.execute(
        "UPDATE identity.partner_configs SET wellhub_gym_id = external_gym_id"
    )
    op.execute(
        "ALTER TABLE identity.partner_configs ALTER COLUMN wellhub_gym_id DROP DEFAULT"
    )

    op.drop_column("partner_configs", "external_gym_id", schema="identity")
    op.drop_column("partner_configs", "platform", schema="identity")

    op.create_unique_constraint(
        "wellhub_configs_organization_id_key",
        "partner_configs",
        ["organization_id"],
        schema="identity",
    )
    op.create_index(
        "ix_wellhub_configs_organization_id",
        "partner_configs",
        ["organization_id"],
        schema="identity",
    )
    op.create_index(
        "ix_wellhub_configs_wellhub_gym_id",
        "partner_configs",
        ["wellhub_gym_id"],
        schema="identity",
    )

    op.rename_table("partner_configs", "wellhub_configs", schema="identity")
