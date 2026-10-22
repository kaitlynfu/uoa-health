"""Private export and explicit password-confirmed account erasure.

An anonymous actor ID remains for shared route history/other users' messages.
Personal data, memberships and authored messages are removed, not just hidden.
"""
from fastapi import APIRouter, Depends, HTTPException, Response
import base64
from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import Session
from app.database import Base, get_db
from app import models as m
from app.schemas import LoginRequest, StudentProfileResponse
from app.services.auth_service import get_current_user
from app.services.profile_service import build_profile
from app.services.milestone_labels import milestone_labels
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix='/account', tags=['Account data'])


@router.get('/export')
def export(user: m.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Explicit fields only: never serialize an ORM user/password/session wholesale.
    groups = db.query(m.GroupMember).filter_by(user_id=user.id).all()
    messages = db.query(m.Message).filter_by(sender_id=user.id).order_by(m.Message.id).all()
    photo=db.get(m.ProfilePhoto,user.id)
    return {'profile': StudentProfileResponse.model_validate(build_profile(db, user)),
            'groups': [{'group_id':row.group_id, 'role':row.role.value, 'joined_at':row.joined_at} for row in groups],
            'authored_messages': [{'id':row.id, 'content':row.content, 'recipient_id':row.recipient_id,
                'group_id':row.group_id, 'created_at':row.created_at} for row in messages],
            'milestone_labels': milestone_labels(db, user.id),
            'journey': [{'milestone_id': row.milestone_id, 'completed':row.completed,
                'completed_at':row.completed_at} for row in user.milestone_progress],
            'saved_groups': [row.group_id for row in db.query(m.SavedGroup).filter_by(user_id=user.id)],
            'profile_photo_base64':base64.b64encode(photo.image).decode() if photo else None,
            'exported_at': m.utc_now()}


def erase_group(db, group_id):
    ids = select(m.Message.id).where(m.Message.group_id == group_id)
    db.execute(delete(m.MessageRead).where(m.MessageRead.message_id.in_(ids)))
    db.execute(update(m.SafetyReport).where(m.SafetyReport.message_id.in_(ids)).values(message_id=None))
    db.execute(delete(m.Message).where(m.Message.group_id == group_id))
    for model in (m.SavedGroup, m.GroupMember):
        db.execute(delete(model).where(model.group_id == group_id))
    db.execute(delete(m.Group).where(m.Group.id == group_id))


@router.delete('', status_code=204)
def erase(request: LoginRequest, user: m.User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.services.request_limits import throttle
    throttle(db, 'account-delete', user.id, 5)
    if request.email.strip().casefold() != user.email or not verify_password(request.password, user.password_hash):
        raise HTTPException(400, 'Confirm your account email and current password')
    memberships = db.query(m.GroupMember).filter_by(user_id=user.id).all()
    for membership in memberships:
        db.query(m.Group).filter_by(id=membership.group_id).with_for_update().first()
        if membership.role == m.GroupRole.ADMIN:
            successor = db.query(m.GroupMember).filter(m.GroupMember.group_id==membership.group_id,
                m.GroupMember.user_id!=user.id).order_by(m.GroupMember.joined_at, m.GroupMember.id).first()
            if successor: successor.role = m.GroupRole.ADMIN
            else: erase_group(db, membership.group_id)
    db.flush()
    authored = select(m.Message.id).where(m.Message.sender_id==user.id)
    db.execute(delete(m.MessageRead).where(m.MessageRead.message_id.in_(authored)))
    db.execute(update(m.SafetyReport).where(m.SafetyReport.message_id.in_(authored)).values(message_id=None))
    db.execute(delete(m.Message).where(m.Message.sender_id==user.id))
    db.execute(delete(m.Friendship).where(or_(m.Friendship.user_id==user.id, m.Friendship.friend_id==user.id)))
    db.execute(delete(m.BlockedUser).where(or_(m.BlockedUser.user_id==user.id, m.BlockedUser.blocked_id==user.id)))
    db.execute(delete(m.SafetyReport).where(m.SafetyReport.reporter_id==user.id))
    # All account-owned records carry user_id. Preserve only the user actor row;
    # shared route editor FKs and received messages remain anonymous references.
    for table in reversed(Base.metadata.sorted_tables):
        if 'user_id' in table.c and table.name not in ('friendships', 'blocked_users', 'deleted_accounts'):
            db.execute(delete(table).where(table.c.user_id==user.id))
    user.email = f'deleted-{user.id}-{create_access_token()}@example.invalid'
    user.display_name = 'Former member'
    user.password_hash = hash_password(create_access_token())
    db.add(m.DeletedAccount(user_id=user.id)); db.commit()
    return Response(status_code=204)
