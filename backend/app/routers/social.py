from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import (
    FriendshipCreate,
    FriendshipResponse,
    GroupCreate,
    GroupOwnershipRequest,
    GroupResponse,
    MessageCreate,
    MessageResponse,
)
from app.services.auth_service import get_current_user
from app.services.request_limits import throttle
from app.services.social_service import SocialService

router = APIRouter(prefix="/social", tags=["Social & Messaging"])


@router.post(
    "/friends/request",
    response_model=FriendshipResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_friend_request(
    request: FriendshipCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = SocialService(db)
    try:
        return service.send_friend_request(
            requester_id=user.id, target_id=request.friend_id
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )


@router.post("/friends/{friend_id}/accept")
def accept_request(
    friend_id: int = Path(ge=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = SocialService(db)
    success = service.accept_friend_request(
        user_id=user.id, friend_id=friend_id
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pending friend request not found",
        )
    return {"message": "Friend request accepted"}


@router.delete("/friends/{friend_id}")
def remove_friendship(
    friend_id: int = Path(ge=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = SocialService(db)
    success = service.remove_friend(user_id=user.id, friend_id=friend_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friendship not found",
        )
    return {"message": "Friend removed successfully"}


@router.post(
    "/groups",
    response_model=GroupResponse,
    status_code=status.HTTP_201_CREATED,
)
def make_group(
    request: GroupCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = SocialService(db)
    return service.create_group(creator_id=user.id, **request.model_dump())


@router.post("/groups/{group_id}/join")
def join_existing_group(
    group_id: int = Path(ge=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = SocialService(db)
    service.join_group(user_id=user.id, group_id=group_id)
    return {"message": "Joined group successfully"}


@router.delete("/groups/{group_id}/leave")
def leave_existing_group(
    group_id: int = Path(ge=1),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = SocialService(db)
    success = service.leave_group(user_id=user.id, group_id=group_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group membership not found",
        )
    return {"message": "Left group successfully"}


def owned_group(db, user_id, group_id):
    from app.models import Group, GroupRole
    # Serialize ownership changes/deletion with a group row lock on PostgreSQL.
    group = db.query(Group).filter_by(id=group_id).with_for_update().first()
    if group is None: raise HTTPException(404, 'Group not found')
    if SocialService(db).require_member(user_id, group_id).role != GroupRole.ADMIN:
        raise HTTPException(403, 'Group owner required')
    return group


@router.put('/groups/{group_id}', response_model=GroupResponse)
def edit_group(request: GroupCreate, group_id: int = Path(ge=1),
               user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    group = owned_group(db, user.id, group_id)
    for field, value in request.model_dump().items(): setattr(group, field, value)
    db.commit(); db.refresh(group)
    return group


@router.post('/groups/{group_id}/ownership', status_code=204)
def transfer_group(request: GroupOwnershipRequest, group_id: int = Path(ge=1),
                   user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models import GroupRole
    owned_group(db, user.id, group_id)
    if request.new_owner_id == user.id: raise HTTPException(422, 'Choose another member')
    service = SocialService(db)
    incoming = service.require_member(request.new_owner_id, group_id)
    incoming.role = GroupRole.ADMIN
    service.require_member(user.id, group_id).role = GroupRole.MEMBER
    db.commit()
    return Response(status_code=204)


@router.delete('/groups/{group_id}', status_code=204)
def delete_group(group_id: int = Path(ge=1), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models import GroupMember, Message, MessageRead, SafetyReport, SavedGroup
    group = owned_group(db, user.id, group_id)
    message_ids = db.query(Message.id).filter_by(group_id=group_id)
    db.query(MessageRead).filter(MessageRead.message_id.in_(message_ids)).delete(synchronize_session=False)
    db.query(SafetyReport).filter(SafetyReport.message_id.in_(message_ids)).update({'message_id':None}, synchronize_session=False)
    db.query(Message).filter_by(group_id=group_id).delete(synchronize_session=False)
    db.query(SavedGroup).filter_by(group_id=group_id).delete(synchronize_session=False)
    db.query(GroupMember).filter_by(group_id=group_id).delete(synchronize_session=False)
    db.delete(group); db.commit()
    return Response(status_code=204)


@router.post(
    "/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def send_new_message(
    request: MessageCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    throttle(db, 'send-message', user.id, 60, seconds=60)
    service = SocialService(db)
    try:
        return service.save_message(
            sender_id=user.id,
            content=request.content,
            recipient_id=request.recipient_id,
            group_id=request.group_id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )

@router.get(
    "/messages/group/{group_id}",
    response_model=list[MessageResponse],
)
def read_group_messages(
    group_id: int = Path(ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    before_id: int | None = Query(default=None, ge=1),
    after_id: int | None = Query(default=None, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = SocialService(db)
    if before_id is not None and after_id is not None: raise HTTPException(422, 'Choose one history direction')
    return service.get_group_messages(group_id=group_id, user_id=user.id, limit=limit, before_id=before_id, after_id=after_id)


@router.get(
    "/messages/direct/{other_user_id}",
    response_model=list[MessageResponse],
)
def read_direct_messages(
    other_user_id: int = Path(ge=1),
    limit: int = Query(default=50, ge=1, le=100),
    before_id: int | None = Query(default=None, ge=1),
    after_id: int | None = Query(default=None, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    service = SocialService(db)
    if before_id is not None and after_id is not None: raise HTTPException(422, 'Choose one history direction')
    return service.get_direct_messages(user_id=user.id, other_user_id=other_user_id, limit=limit, before_id=before_id, after_id=after_id)


@router.get('/conversations/{kind}/{target_id}/metadata')
def conversation_metadata(kind: str, target_id: int = Path(ge=1),
                          user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service = SocialService(db)
    if kind == 'group':
        service.require_member(user.id, target_id)
        from app.models import Group
        return {'name': db.get(Group, target_id).name}
    if kind == 'direct':
        service.require_user(target_id)
        from app.models import BlockedUser
        return {'name': db.get(User, target_id).display_name,
                'blocked': db.get(BlockedUser, (user.id, target_id)) is not None}
    raise HTTPException(422, 'Choose direct or group')
