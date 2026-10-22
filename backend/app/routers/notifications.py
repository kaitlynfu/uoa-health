"""In-app notifications derived from current unread messages and pending requests.

There is deliberately no claim of OS push delivery without APNs/FCM credentials.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import NotificationPreference, User
from app.schemas import NotificationPreferenceRequest
from app.services.auth_service import get_current_user
from app.routers.social_directory import connection_list
from app.routers.social_inbox import inbox

router = APIRouter(prefix='/notifications', tags=['In-app notifications'])


def preferences(db, user_id):
    value = db.get(NotificationPreference, user_id)
    return {'messages': value.messages if value else True,
            'friend_requests': value.friend_requests if value else True, 'push_available': False}


@router.get('/preferences')
def read_preferences(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return preferences(db, user.id)


@router.put('/preferences')
def save_preferences(request: NotificationPreferenceRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    value = db.get(NotificationPreference, user.id)
    if value is None:
        value = NotificationPreference(user_id=user.id); db.add(value)
    value.messages, value.friend_requests = request.messages, request.friend_requests
    db.commit()
    return preferences(db, user.id)


@router.get('')
def notifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prefs = preferences(db, user.id)
    items = []
    if prefs['friend_requests']:
        for connection in connection_list(db, user.id, True, 'incoming', 50, 0):
            items.append({'key': f"friend:{connection['id']}", 'kind':'friend',
                          'title': connection['user']['display_name'] + ' sent a friend request',
                          'target_id': connection['user']['id'], 'created_at': connection['created_at']})
    if prefs['messages']:
        for conversation in inbox(50, 0, user, db):
            if conversation['unread_count']:
                items.append({'key': f"{conversation['kind']}:{conversation['target_id']}",
                              'kind': conversation['kind'], 'target_id': conversation['target_id'],
                              'title': f"{conversation['name']}: {conversation['unread_count']} unread messages",
                              'created_at': conversation['last_message'].created_at})
    return sorted(items, key=lambda item: item['created_at'], reverse=True)
