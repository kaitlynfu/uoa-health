"""Upgrade only a restored readiness rehearsal copy; never target production."""
import os
import sys
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from rehearse_social_postgres import snapshot, check_preserved, run_alembic

TARGET='team43_readiness_rehearsal'
NEW_TABLES={'blocked_users','safety_reports','account_email_tokens','verified_emails',
            'notification_preferences','request_limits','deleted_accounts','profile_photos'}


def checked_url(value):
    url=make_url(value)
    if (url.drivername!='postgresql+psycopg' or url.database!=TARGET or url.username!='ubuntu'
        or url.host is not None or url.password is not None or url.port is not None
        or dict(url.query)!={'host':'/var/run/postgresql'}):
        raise ValueError('Only ubuntu peer authentication on the local team43_readiness_rehearsal copy is allowed.')
    return url


def rehearse(value):
    url=checked_url(value);engine=create_engine(url,pool_pre_ping=True)
    try:
        with engine.connect() as connection:
            if connection.scalar(text('SELECT current_database()'))!=TARGET:raise ValueError('Database identity mismatch')
            if connection.scalar(text('SELECT version_num FROM alembic_version'))!='0004':raise ValueError('Restore a fresh revision 0004 copy first')
            before=snapshot(connection)
            if NEW_TABLES.intersection(before):raise ValueError('New readiness tables already present')
        run_alembic(url,'upgrade','0005');run_alembic(url,'check')
        with engine.connect() as connection:
            check_preserved(before,snapshot(connection,{name:row['columns'] for name,row in before.items()}))
            if set(inspect(connection).get_table_names())!=set(before)|NEW_TABLES|{'alembic_version'}:raise ValueError('Unexpected table set')
            if connection.scalar(text('SELECT version_num FROM alembic_version'))!='0005':raise ValueError('Unexpected migration revision')
            for name in sorted(NEW_TABLES):
                if connection.scalar(text(f'SELECT COUNT(*) FROM {name}'))!=0:raise ValueError('New tables must start empty')
        for name,row in before.items():print(f"{name}: {row['count']} original rows preserved")
        print('PASS: readiness revision 0005, schema check and every original row preserved on the rehearsal copy.')
    finally:engine.dispose()


if __name__=='__main__':
    try:rehearse(os.getenv('DATABASE_URL',''))
    except Exception as error:
        print(f'Rehearsal stopped ({type(error).__name__}); live database was not targeted.',file=sys.stderr)
        raise SystemExit(1) from None
