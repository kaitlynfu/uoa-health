"""Group details, saved groups and per-user message reads.

Existing messages start unread; existing groups remain public-join.
"""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade():
    for name, length, default in (
        ('course', 100, ''), ('description', 2000, ''),
        ('group_type', 40, 'Other'), ('location', 200, ''),
        ('study_format', 20, 'Hybrid'),
    ):
        op.add_column('groups', sa.Column(name, sa.String(length), nullable=False, server_default=default))
    op.add_column('groups', sa.Column('preferred_days', sa.JSON(), nullable=False, server_default='[]'))
    op.create_table('saved_groups',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('group_id', sa.Integer(), sa.ForeignKey('groups.id'), primary_key=True))
    op.create_table('message_reads',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('message_id', sa.Integer(), sa.ForeignKey('messages.id'), primary_key=True),
        sa.Column('read_at', sa.DateTime(), nullable=False))


def downgrade():
    op.drop_table('message_reads')
    op.drop_table('saved_groups')
    with op.batch_alter_table('groups') as batch:
        for name in ('preferred_days', 'study_format', 'location', 'group_type', 'description', 'course'):
            batch.drop_column(name)
