"""notifications table for business alerts

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-30
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=150), nullable=False),
        sa.Column("message", sa.String(length=500), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("priority", sa.String(length=20), server_default="medium", nullable=False),
        sa.Column("related_entity_type", sa.String(length=30), nullable=True),
        sa.Column("related_entity_id", sa.Integer(), nullable=True),
        sa.Column("dedupe_key", sa.String(length=120), nullable=True),
        sa.Column("is_read", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "type IN ('revenue', 'sales', 'order', 'customer', 'system')", name=op.f("ck_notifications_type_valid")
        ),
        sa.CheckConstraint(
            "priority IN ('low', 'medium', 'high', 'critical')", name=op.f("ck_notifications_priority_valid")
        ),
        sa.CheckConstraint(
            "(is_read AND read_at IS NOT NULL) OR (NOT is_read AND read_at IS NULL)",
            name=op.f("ck_notifications_read_state_consistent"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_notifications_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notifications")),
    )
    op.create_index("uq_notifications_user_dedupe", "notifications", ["user_id", "dedupe_key"], unique=True)
    op.create_index("ix_notifications_user_created", "notifications", ["user_id", "created_at"])
    op.create_index("ix_notifications_user_unread", "notifications", ["user_id", "is_read"])
    op.create_index("ix_notifications_user_type", "notifications", ["user_id", "type"])
    op.create_index("ix_notifications_user_priority", "notifications", ["user_id", "priority"])


def downgrade() -> None:
    op.drop_table("notifications")