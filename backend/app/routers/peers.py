"""Opt-in suggestions from shared declared interests, not inferred demographics."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session, aliased
from app.database import get_db
from app.models import BlockedUser, DeletedAccount, Friendship, StudentAttribute, StudentPersonalisation, User
from app.routers.safety import blocked_ids
from app.services.auth_service import get_current_user

router = APIRouter(prefix='/social', tags=['Peer suggestions'])


@router.get('/suggestions')
def suggestions(limit: int = Query(20, ge=1, le=50), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.personalisation or not user.personalisation.matching_enabled: return []
    own, peer = aliased(StudentAttribute), aliased(StudentAttribute)
    connected = select(case((Friendship.user_id==user.id, Friendship.friend_id), else_=Friendship.user_id)).where(
        or_(Friendship.user_id==user.id, Friendship.friend_id==user.id))
    scores = select(peer.user_id.label('peer_id'), func.count().label('shared_count')).join(own,
        and_(own.kind==peer.kind, own.normalised_value==peer.normalised_value)).where(
            own.user_id==user.id, peer.user_id!=user.id).group_by(peer.user_id).subquery()
    rows = db.execute(select(User.id, User.display_name, scores.c.shared_count).join(scores, scores.c.peer_id==User.id)
        .join(StudentPersonalisation, StudentPersonalisation.user_id==User.id).where(
            StudentPersonalisation.matching_enabled.is_(True), ~User.id.in_(connected),
            ~User.id.in_(blocked_ids(db,user.id)),
            ~User.id.in_(select(BlockedUser.user_id).where(BlockedUser.blocked_id==user.id)),
            ~User.id.in_(select(DeletedAccount.user_id)))
        .order_by(scores.c.shared_count.desc(), User.id).limit(limit)).all()
    return [{'id':pid,'display_name':name,'shared_count':count} for pid,name,count in rows]
