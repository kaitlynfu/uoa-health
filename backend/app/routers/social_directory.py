"""Authenticated public names and group directory; private connection/member lists."""
from typing import Literal

from fastapi import APIRouter, Depends, Path, Query
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DeletedAccount, Friendship, FriendshipStatus, Group, GroupMember, SavedGroup, User
from app.schemas import (FriendConnectionResponse, GroupMemberResponse,
                         GroupResponse, GroupSummaryResponse, SocialUserResponse)
from app.services.auth_service import get_current_user
from app.services.social_service import SocialService
from app.routers.safety import blocked_ids

router = APIRouter(prefix='/social', tags=['Social directory'])


def literal_search(value):
    return '%' + value.strip().replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_') + '%'


def connection(friendship, user_id):
    if friendship.status == FriendshipStatus.ACCEPTED:
        return 'friend'
    return 'outgoing' if friendship.user_id == user_id else 'incoming'


@router.get('/users', response_model=list[SocialUserResponse])
def search_users(q: str = Query(min_length=2, max_length=100),
                 limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
                 user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if len(q.strip()) < 2:
        return []
    peers = db.scalars(select(User).where(User.id != user.id, ~User.id.in_(blocked_ids(db, user.id)),
        ~User.id.in_(select(DeletedAccount.user_id)),
        User.display_name.ilike(literal_search(q), escape='\\'))
        .order_by(func.lower(User.display_name), User.id).offset(offset).limit(limit)).all()
    ids = [peer.id for peer in peers]
    states = {}
    if ids:
        friendships = db.scalars(select(Friendship).where(or_(
            and_(Friendship.user_id == user.id, Friendship.friend_id.in_(ids)),
            and_(Friendship.friend_id == user.id, Friendship.user_id.in_(ids))))).all()
        for friendship in friendships:
            peer_id = friendship.friend_id if friendship.user_id == user.id else friendship.user_id
            states[peer_id] = connection(friendship, user.id)
    return [{'id': peer.id, 'display_name': peer.display_name, 'connection': states.get(peer.id, 'none')}
            for peer in peers]


def connection_list(db, user_id, pending, direction, limit, offset):
    peer_id = case((Friendship.user_id == user_id, Friendship.friend_id), else_=Friendship.user_id)
    scope = or_(Friendship.user_id == user_id, Friendship.friend_id == user_id)
    if pending:
        scope = Friendship.friend_id == user_id if direction == 'incoming' else Friendship.user_id == user_id
    rows = db.execute(select(Friendship, User).join(User, User.id == peer_id).where(
        scope, Friendship.status == (FriendshipStatus.PENDING if pending else FriendshipStatus.ACCEPTED))
        .order_by(Friendship.created_at.desc(), Friendship.id.desc()).offset(offset).limit(limit)).all()
    return [{'id': f.id, 'created_at': f.created_at,
             'user': {'id': peer.id, 'display_name': peer.display_name, 'connection': connection(f, user_id)}}
            for f, peer in rows]


@router.get('/friends', response_model=list[FriendConnectionResponse])
def friends(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
            user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return connection_list(db, user.id, False, None, limit, offset)


@router.get('/friends/requests', response_model=list[FriendConnectionResponse])
def requests(direction: Literal['incoming', 'outgoing'] = 'incoming',
             limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
             user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return connection_list(db, user.id, True, direction, limit, offset)


def group_query(user_id):
    counts = select(GroupMember.group_id, func.count().label('member_count')).group_by(GroupMember.group_id).subquery()
    own = select(GroupMember.group_id, GroupMember.role).where(GroupMember.user_id == user_id).subquery()
    saved = select(SavedGroup.group_id).where(SavedGroup.user_id == user_id).subquery()
    return select(Group, func.coalesce(counts.c.member_count, 0), own.c.role, saved.c.group_id).outerjoin(
        counts, counts.c.group_id == Group.id).outerjoin(own, own.c.group_id == Group.id).outerjoin(
        saved, saved.c.group_id == Group.id)


def summaries(rows):
    return [{**GroupResponse.model_validate(group).model_dump(), 'member_count': count,
             'joined': role is not None, 'role': role.value if role is not None else None,
             'saved': saved is not None} for group, count, role, saved in rows]


@router.get('/groups/joined', response_model=list[GroupSummaryResponse])
def joined_groups(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return summaries(db.execute(group_query(user.id).where(Group.id.in_(select(GroupMember.group_id)
        .where(GroupMember.user_id == user.id))).order_by(Group.id.desc()).offset(offset).limit(limit)).all())


@router.get('/groups', response_model=list[GroupSummaryResponse])
def search_groups(q: str = Query('', max_length=100), course: str = Query('', max_length=100),
                  study_format: Literal['In Person', 'Online', 'Hybrid'] | None = None,
                  limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    statement = group_query(user.id)
    if q.strip():
        value = literal_search(q)
        statement = statement.where(or_(Group.name.ilike(value, escape='\\'), Group.description.ilike(value, escape='\\'),
                                       Group.course.ilike(value, escape='\\')))
    if course.strip():
        statement = statement.where(Group.course.ilike(literal_search(course), escape='\\'))
    if study_format:
        statement = statement.where(Group.study_format == study_format)
    return summaries(db.execute(statement.order_by(Group.id.desc()).offset(offset).limit(limit)).all())


@router.get('/groups/{group_id}', response_model=GroupSummaryResponse)
def group_details(group_id: int = Path(ge=1), user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    SocialService(db).require_group(group_id)
    return summaries(db.execute(group_query(user.id).where(Group.id == group_id)).all())[0]


@router.get('/groups/{group_id}/members', response_model=list[GroupMemberResponse])
def group_members(group_id: int = Path(ge=1), limit: int = Query(50, ge=1, le=100),
                  offset: int = Query(0, ge=0), user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    service = SocialService(db)
    service.require_group(group_id)
    service.require_member(user.id, group_id)
    rows = db.execute(select(GroupMember, User).join(User, User.id == GroupMember.user_id)
        .where(GroupMember.group_id == group_id).order_by(GroupMember.id).offset(offset).limit(limit)).all()
    return [{'user': {'id': peer.id, 'display_name': peer.display_name},
             'role': membership.role.value, 'joined_at': membership.joined_at} for membership, peer in rows]
