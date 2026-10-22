"""Create a NEW local-only integration DB. Never accepts a production DB URL.

Run from backend: python -m scripts.seed_integration
Then use DATABASE_URL=sqlite:///.../backend/.integration-local/integration.db.
All user identities and career descriptions below are synthetic test fixtures.
"""
import os
from pathlib import Path

LOCAL_DIR = Path(__file__).resolve().parents[1] / '.integration-local'
LOCAL_DB = LOCAL_DIR / 'integration.db'
TEST_PASSWORD = 'Team43-Local-Only-2026!'


def main():
    # Refuse arbitrary target selection and existing files before importing DB code.
    if os.getenv('DATABASE_URL'):
        raise SystemExit('Unset DATABASE_URL before seeding; this script chooses its own local-only path.')
    # Python 3.13+ maps 0700 to an owner-only Windows ACL. When an agent
    # creates this folder that owner may be a sandbox account, locking out
    # the developer. On Windows inherit the workspace ACL instead.
    LOCAL_DIR.mkdir(mode=0o777 if os.name == 'nt' else 0o700, exist_ok=True)
    if LOCAL_DB.exists():
        raise SystemExit(f'Existing local test DB preserved: {LOCAL_DB}')
    with LOCAL_DB.open('xb'):
        pass
    os.environ['DATABASE_URL'] = 'sqlite:///' + LOCAL_DB.as_posix()
    from app.database import Base, engine, SessionLocal
    from app.models import Programme, SavedProgramme, SavedCareer, StudentAttribute
    from app.services.auth_service import register_user
    from app.services.career_service import sync_all_programme_careers
    from app.services.journey_service import select_programme, update_milestone
    from app.services.social_service import SocialService
    from scripts import seed_journey
    from scripts.seed_wayfinding import seed_campuses, seed_buildings
    from scripts.seed_building_303 import seed_building_303
    Base.metadata.create_all(engine)
    names = [
        ('Bachelor of Health Sciences', 'Public health analyst, health policy adviser'),
        ('Bachelor of Nursing', 'Registered nurse, clinical researcher'),
        ('Bachelor of Pharmacy', 'Pharmacist, medicines safety adviser'),
        ('Bachelor of Optometry', 'Optometrist'),
        ('Bachelor of Medicine', 'Doctor, medical researcher'),
        ('Certificate in Health Sciences', 'Community health worker'),
        ('Bachelor of Biomedical Science', 'Laboratory scientist'),
        ('Bachelor of Sport', 'Exercise scientist'),
        ('Bachelor of Science', 'Data analyst, psychologist'),
    ]
    with SessionLocal() as db:
        for index, (name, careers) in enumerate(names):
            db.add(Programme(name=name, faculty='Integration test faculty',
                description='Synthetic local fixture for UI/API testing; not academic advice.',
                duration='Test duration', entry_requirements='See official programme information.',
                career_pathways=careers, programme_url=f'https://example.test/programmes/{index+1}'))
        db.flush()
        sync_all_programme_careers(db)
        seed_buildings(db, seed_campuses(db))
        seed_building_303(db)
        db.commit()
    seed_journey.main()
    with SessionLocal() as db:
        users = [register_user(db, f'{name}@example.test', TEST_PASSWORD, name.title())
                 for name in ('alice', 'bob', 'outsider')]
        db.commit()
        alice, bob, _ = users
        programme = db.query(Programme).filter_by(name='Bachelor of Health Sciences').one()
        journey = select_programme(db, alice, programme.id, 1, 2027, 'COMH_STANDARD')
        update_milestone(db, alice, journey['milestones'][0]['id'] if isinstance(journey['milestones'][0], dict)
                         else journey['milestones'][0].id, {'completed': True})
        db.add(SavedProgramme(user_id=alice.id, programme_id=programme.id))
        db.add(SavedCareer(user_id=alice.id, career_id=programme.careers[0].id))
        db.add(StudentAttribute(user_id=alice.id, kind='interest', value='Public health', normalised_value='public health'))
        db.commit()
        social = SocialService(db)
        social.send_friend_request(alice.id, bob.id)
        social.accept_friend_request(bob.id, alice.id)
        group = social.create_group(alice.id, 'Local integration study group (public join)')
        social.join_group(bob.id, group.id)
        social.save_message(alice.id, 'Synthetic direct-message fixture', recipient_id=bob.id)
        social.save_message(bob.id, 'Synthetic group-message fixture', group_id=group.id)
    engine.dispose()
    print(f'Local test database: {LOCAL_DB}')
    print('Test accounts only: alice@example.test, bob@example.test, outsider@example.test')
    print('Password for these local-only fixtures: ' + TEST_PASSWORD)
    print('Never seed these accounts into AWS or expose this test server publicly.')


if __name__ == '__main__':
    main()
