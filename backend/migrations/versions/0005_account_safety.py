"""Additive account recovery, safety controls, preferences and chat indexes.

No existing account, group, message or route row is rewritten by this revision.
"""
from alembic import op
import sqlalchemy as sa

revision = '0005'
down_revision = '0004'
branch_labels = depends_on = None


def upgrade():
    op.create_table('profile_photos',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('image', sa.LargeBinary(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False))
    op.create_table('deleted_accounts',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=False))
    op.create_index('ix_messages_direct_page', 'messages', ['sender_id', 'recipient_id', 'id'])
    op.create_index('ix_messages_group_page', 'messages', ['group_id', 'id'])
    op.create_table('blocked_users',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('blocked_id', sa.Integer(), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('created_at', sa.DateTime(), nullable=False))
    op.create_table('safety_reports',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('reporter_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('message_id', sa.Integer(), sa.ForeignKey('messages.id')),
        sa.Column('reason', sa.String(2000), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False))
    op.create_table('account_email_tokens',
        sa.Column('token_hash', sa.String(64), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('purpose', sa.String(20), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False))
    op.create_index('ix_account_email_tokens_user_id', 'account_email_tokens', ['user_id'])
    op.create_table('verified_emails',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('verified_at', sa.DateTime(), nullable=False))
    op.create_table('notification_preferences',
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('messages', sa.Boolean(), nullable=False),
        sa.Column('friend_requests', sa.Boolean(), nullable=False))
    op.create_table('request_limits', sa.Column('key', sa.String(64), primary_key=True),
        sa.Column('window', sa.Integer(), nullable=False), sa.Column('count', sa.Integer(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False))
    op.create_index('ix_request_limits_expires_at', 'request_limits', ['expires_at'])


def downgrade():
    for table in ('profile_photos', 'deleted_accounts', 'request_limits', 'notification_preferences', 'verified_emails',
                  'account_email_tokens', 'safety_reports', 'blocked_users'):
        op.drop_table(table)
    op.drop_index('ix_messages_group_page', table_name='messages')
    op.drop_index('ix_messages_direct_page', table_name='messages')
