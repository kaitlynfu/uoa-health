"""Inbox/read tracking and bookmarks; independent of friend/group discovery."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response
from sqlalchemy import and_, case, func, literal, or_, select, union_all
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DeletedAccount, Group, GroupMember, Message, MessageRead, SavedGroup, User, utc_now
from app.schemas import ConversationResponse, GroupResponse, MarkMessagesRead
from app.services.auth_service import get_current_user
from app.services.social_service import SocialService
from app.routers.safety import blocked_ids

router = APIRouter(prefix='/social', tags=['Social inbox and saved groups'])


def insert_ignore(db, model, values):
    # Both supported engines provide atomic conflict handling for repeated requests.
    if db.bind.dialect.name == 'postgresql':
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    db.execute(insert(model).values(values).on_conflict_do_nothing())


@router.get('/groups/saved', response_model=list[GroupResponse])
def saved_groups(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
                 user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Group).join(SavedGroup, SavedGroup.group_id == Group.id)
        .where(SavedGroup.user_id == user.id).order_by(Group.id.desc()).offset(offset).limit(limit)).all()


@router.put('/groups/{group_id}/saved', status_code=204)
def save_group(group_id: int = Path(ge=1), user: User = Depends(get_current_user),
               db: Session = Depends(get_db)):
    SocialService(db).require_group(group_id)
    insert_ignore(db, SavedGroup, {'user_id': user.id, 'group_id': group_id})
    db.commit()
    return Response(status_code=204)


@router.get('/groups/{group_id}/metadata', response_model=GroupResponse)
def group_metadata(group_id: int = Path(ge=1), user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    # Public-join metadata only; membership still protects messages.
    SocialService(db).require_group(group_id)
    return db.get(Group, group_id)


@router.delete('/groups/{group_id}/saved', status_code=204)
def unsave_group(group_id: int = Path(ge=1), user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    db.query(SavedGroup).filter_by(user_id=user.id, group_id=group_id).delete()
    db.commit()
    return Response(status_code=204)


@router.get('/messages/inbox', response_model=list[ConversationResponse])
def inbox(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
          user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    read = select(MessageRead.message_id).where(
        MessageRead.user_id == user.id, MessageRead.message_id == Message.id).exists()
    unread = case((and_(Message.sender_id != user.id, ~read), 1), else_=0)
    peer = case((Message.sender_id == user.id, Message.recipient_id), else_=Message.sender_id)
    direct = select(literal('direct').label('kind'), peer.label('target_id'),
        func.max(Message.id).label('latest'), func.sum(unread).label('unread_count')).where(
        Message.group_id.is_(None), Message.recipient_id.is_not(None),
        ~peer.in_(blocked_ids(db, user.id)),
        # Deleted peers cannot be opened or messaged. Filter before pagination so
        # retained anonymous actor references do not leave broken inbox entries.
        ~peer.in_(select(DeletedAccount.user_id)),
        or_(Message.sender_id == user.id, Message.recipient_id == user.id)).group_by(peer)
    groups = select(literal('group').label('kind'), Message.group_id.label('target_id'),
        func.max(Message.id).label('latest'), func.sum(unread).label('unread_count')).join(
        GroupMember, and_(GroupMember.group_id == Message.group_id, GroupMember.user_id == user.id)
        ).where(~Message.sender_id.in_(blocked_ids(db, user.id))).group_by(Message.group_id)
    conversations = union_all(direct, groups).subquery()
    rows = db.execute(select(conversations).order_by(conversations.c.latest.desc())
        .offset(offset).limit(limit)).mappings().all()
    result = []
    for row in rows:
        target = db.get(Group if row['kind'] == 'group' else User, row['target_id'])
        result.append({'kind': row['kind'], 'target_id': row['target_id'],
            'name': target.name if row['kind'] == 'group' else target.display_name,
            'last_message': db.get(Message, row['latest']), 'unread_count': row['unread_count']})
    return result


@router.post('/messages/{kind}/{target_id}/read', status_code=204)
def mark_read(request: MarkMessagesRead, kind: Literal['direct', 'group'],
              target_id: int = Path(ge=1), user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    service = SocialService(db)
    if kind == 'group':
        service.require_member(user.id, target_id)
        scope = Message.group_id == target_id
    else:
        service.require_user(target_id)
        scope = and_(Message.group_id.is_(None), or_(
            and_(Message.sender_id == user.id, Message.recipient_id == target_id),
            and_(Message.sender_id == target_id, Message.recipient_id == user.id)))
    # The client must acknowledge an actual message it loaded from this conversation.
    if db.scalar(select(Message.id).where(scope, Message.id == request.through_message_id)) is None:
        raise HTTPException(404, 'Message not found in this conversation')
    read = select(MessageRead.message_id).where(
        MessageRead.user_id == user.id, MessageRead.message_id == Message.id).exists()
    ids = db.scalars(select(Message.id).where(scope, Message.id <= request.through_message_id,
        Message.sender_id != user.id, ~read)).all()
    for start in range(0, len(ids), 200):
        insert_ignore(db, MessageRead, [{'user_id': user.id, 'message_id': mid,
            'read_at': utc_now()} for mid in ids[start:start + 200]])
    db.commit()
    return Response(status_code=204)
