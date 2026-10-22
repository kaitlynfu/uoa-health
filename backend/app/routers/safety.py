"""Account-owned safety controls and operator-authorized report review."""
import os
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import BlockedUser, Message, SafetyReport, User
from app.schemas import SafetyReportRequest
from app.services.auth_service import get_current_user
from app.services.social_service import SocialService
from app.services.request_limits import throttle

router = APIRouter(prefix='/social', tags=['Safety'])


def blocked_ids(db, user_id):
    return select(BlockedUser.blocked_id).where(BlockedUser.user_id == user_id)


def require_unblocked(db, first, second):
    if db.scalar(select(BlockedUser.user_id).where(or_(
        and_(BlockedUser.user_id == first, BlockedUser.blocked_id == second),
        and_(BlockedUser.user_id == second, BlockedUser.blocked_id == first)))) is not None:
        raise HTTPException(403, 'This connection is not available')


def can_moderate(user):
    parts = os.getenv('TEAM43_MODERATOR_USER_IDS', '').split(',')
    return bool(parts) and all(p.strip().isascii() and p.strip().isdigit() and int(p)>0 for p in parts) and user.id in {int(p) for p in parts}


@router.get('/moderation/access')
def moderation_access(user: User = Depends(get_current_user)):
    return {'can_moderate': can_moderate(user)}


@router.get('/reports/mine')
def my_reports(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
               user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(SafetyReport).filter_by(reporter_id=user.id).order_by(SafetyReport.id.desc()).offset(offset).limit(limit).all()
    return [{'id': row.id, 'reason': row.reason, 'status': row.status, 'created_at': row.created_at} for row in rows]


@router.get('/blocked')
def blocked(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
            user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(User).where(User.id.in_(blocked_ids(db, user.id)))
                      .order_by(User.id).limit(limit).offset(offset)).all()
    return [{'id': peer.id, 'display_name': peer.display_name} for peer in rows]


@router.put('/blocked/{peer_id}', status_code=204)
def block(peer_id: int = Path(ge=1), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if peer_id == user.id: raise HTTPException(422, 'You cannot block yourself')
    SocialService(db).require_user(peer_id)
    from app.routers.social_inbox import insert_ignore
    from app.models import utc_now
    insert_ignore(db, BlockedUser, {'user_id':user.id,'blocked_id':peer_id,'created_at':utc_now()})
    from app.models import Friendship
    db.query(Friendship).filter(or_(and_(Friendship.user_id==user.id, Friendship.friend_id==peer_id),
        and_(Friendship.user_id==peer_id, Friendship.friend_id==user.id))).delete(synchronize_session=False)
    db.commit()
    return Response(status_code=204)


@router.delete('/blocked/{peer_id}', status_code=204)
def unblock(peer_id: int = Path(ge=1), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(BlockedUser).filter_by(user_id=user.id, blocked_id=peer_id).delete()
    db.commit()
    return Response(status_code=204)


@router.post('/reports', status_code=201)
def report(request: SafetyReportRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    throttle(db, 'report', user.id, 20)
    if not request.reason.strip(): raise HTTPException(422, 'Describe the problem')
    if request.message_id:
        message = db.get(Message, request.message_id)
        if not message: raise HTTPException(404, 'Message not found')
        if message.group_id: SocialService(db).require_member(user.id, message.group_id)
        elif user.id not in (message.sender_id, message.recipient_id): raise HTTPException(404, 'Message not found')
    item = SafetyReport(reporter_id=user.id, message_id=request.message_id, reason=request.reason.strip())
    db.add(item); db.commit(); db.refresh(item)
    return {'id': item.id, 'status': item.status}


@router.get('/reports')
def review_reports(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not can_moderate(user): raise HTTPException(403, 'Moderator access required')
    rows = db.query(SafetyReport).order_by(SafetyReport.id.desc()).offset(offset).limit(limit).all()
    return [{'id': row.id, 'reason': row.reason, 'status': row.status, 'created_at': row.created_at,
             'message_id': row.message_id, 'reporter_id': row.reporter_id,
             'message_content': db.get(Message, row.message_id).content if row.message_id else None} for row in rows]


@router.delete('/reports/{report_id}/message', status_code=204)
def remove_reported_message(report_id: int = Path(ge=1), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not can_moderate(user): raise HTTPException(403, 'Moderator access required')
    report = db.get(SafetyReport, report_id)
    if report is None: raise HTTPException(404, 'Report not found')
    if report.message_id is not None:
        from app.models import MessageRead
        message_id=report.message_id
        db.query(MessageRead).filter_by(message_id=message_id).delete(synchronize_session=False)
        db.query(SafetyReport).filter_by(message_id=message_id).update({'message_id':None},synchronize_session=False)
        db.query(Message).filter_by(id=message_id).delete(synchronize_session=False)
    report.status='resolved';db.commit()
    return Response(status_code=204)


@router.post('/reports/{report_id}/resolve', status_code=204)
def resolve_report(report_id: int = Path(ge=1), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not can_moderate(user): raise HTTPException(403, 'Moderator access required')
    item = db.get(SafetyReport, report_id)
    if not item: raise HTTPException(404, 'Report not found')
    item.status = 'resolved'; db.commit()
    return Response(status_code=204)
