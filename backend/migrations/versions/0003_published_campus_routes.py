"""Publish campus geometry and environment recordings atomically.

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("published_campus_routes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("route_key", sa.String(24), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("metadata_json", sa.Text(), nullable=False),
        sa.Column("package", sa.LargeBinary(), nullable=False),
        sa.Column("editor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("route_key", "revision"))
    op.create_index("ix_published_campus_routes_route_key", "published_campus_routes", ["route_key"])

def downgrade():
    # Explicit operator action only: destroys publication history and recordings.
    op.drop_index("ix_published_campus_routes_route_key", table_name="published_campus_routes")
    op.drop_table("published_campus_routes")
