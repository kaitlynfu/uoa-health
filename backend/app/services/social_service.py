from sqlalchemy.orm import Session
from fastapi import HTTPException
from sqlalchemy import or_, and_

from app.models import (
    Friendship,
    FriendshipStatus,
    Group,
    GroupMember,
    GroupRole,
    Message, User
)

class SocialService:
    def __init__(self, db: Session):
        self.db = db

    def require_user(self, user_id):
        from app.models import DeletedAccount
        if self.db.get(User, user_id) is None or self.db.get(DeletedAccount, user_id) is not None:
            raise HTTPException(status_code=404, detail='User not found')

    def require_group(self, group_id):
        if self.db.get(Group, group_id) is None:
            raise HTTPException(status_code=404, detail='Group not found')

    def require_member(self, user_id, group_id):
        member = self.db.query(GroupMember).filter_by(user_id=user_id, group_id=group_id).first()
        if member is None:
            raise HTTPException(status_code=403, detail='Group membership required')
        return member

    # --- Friend Management ---
    def send_friend_request(self, requester_id: int, target_id: int) -> Friendship:
        from app.routers.safety import require_unblocked
        require_unblocked(self.db, requester_id, target_id)
        if requester_id == target_id:
            raise ValueError("Cannot send a friend request to self.")
        self.require_user(target_id)

        existing = self.db.query(Friendship).filter(
            or_(
                and_(Friendship.user_id == requester_id, Friendship.friend_id == target_id),
                and_(Friendship.user_id == target_id, Friendship.friend_id == requester_id)
            )
        ).first()

        if existing:
            return existing

        friendship = Friendship(
            user_id=requester_id,
            friend_id=target_id,
            status=FriendshipStatus.PENDING
        )
        self.db.add(friendship)
        self.db.commit()
        self.db.refresh(friendship)
        return friendship

    def accept_friend_request(self, user_id: int, friend_id: int) -> bool:
        friendship = self.db.query(Friendship).filter(
            Friendship.user_id == friend_id,
            Friendship.friend_id == user_id,
            Friendship.status == FriendshipStatus.PENDING
        ).first()

        if not friendship:
            return False

        friendship.status = FriendshipStatus.ACCEPTED
        self.db.commit()
        return True

    def remove_friend(self, user_id: int, friend_id: int) -> bool:
        deleted = self.db.query(Friendship).filter(
            or_(
                and_(Friendship.user_id == user_id, Friendship.friend_id == friend_id),
                and_(Friendship.user_id == friend_id, Friendship.friend_id == user_id)
            )
        ).delete(synchronize_session=False)

        self.db.commit()
        return deleted > 0

    # --- Group Management ---
    def create_group(self, creator_id: int, name: str, **details) -> Group:
        group = Group(name=name, **details)
        self.db.add(group)
        self.db.flush()

        member = GroupMember(
            group_id=group.id,
            user_id=creator_id,
            role=GroupRole.ADMIN
        )
        self.db.add(member)
        self.db.commit()
        self.db.refresh(group)
        return group

    def join_group(self, user_id: int, group_id: int) -> GroupMember:
        # Groups are explicitly public-join in this MVP; reading still requires membership.
        self.require_group(group_id)
        existing = self.db.query(GroupMember).filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id
        ).first()

        if existing:
            return existing

        member = GroupMember(
            group_id=group_id,
            user_id=user_id,
            role=GroupRole.MEMBER
        )
        self.db.add(member)
        self.db.commit()
        self.db.refresh(member)
        return member

    def leave_group(self, user_id: int, group_id: int) -> bool:
        member = self.require_member(user_id, group_id)
        if member.role == GroupRole.ADMIN:
            raise HTTPException(status_code=409, detail='Group owner must transfer ownership or delete the group before leaving')
        deleted = self.db.query(GroupMember).filter(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id
        ).delete(synchronize_session=False)

        self.db.commit()
        return deleted > 0

    # --- Messaging ---
    def save_message(
        self,
        sender_id: int,
        content: str,
        recipient_id: int = None,
        group_id: int = None
    ) -> Message:
        if (recipient_id is None) == (group_id is None):
            raise ValueError('Choose exactly one recipient or group.')
        if not content.strip() or len(content) > 2000:
            raise ValueError('Message must contain 1 to 2000 characters.')
        if group_id is not None:
            self.require_member(sender_id, group_id)
        else:
            self.require_user(recipient_id)
            from app.routers.safety import require_unblocked
            require_unblocked(self.db, sender_id, recipient_id)

        msg = Message(
            sender_id=sender_id,
            recipient_id=recipient_id,
            group_id=group_id,
            content=content
        )
        self.db.add(msg)
        self.db.commit()
        self.db.refresh(msg)
        msg.sender_name = self.db.get(User, sender_id).display_name

        # NOTE: AppSync Event publishing hook can easily plug in here in the future
        # publish_to_appsync(channel=f"chat/{group_id or recipient_id}", payload=msg)

        return msg

    # --- Message Retrieval ---
    def _message_page(self, query, limit, before_id, after_id):
        if before_id is not None:
            query = query.filter(Message.id < before_id)
        if after_id is not None:
            query = query.filter(Message.id > after_id)
        rows = query.order_by(Message.id.asc() if after_id is not None else Message.id.desc()).limit(limit).all()
        # One bounded name query rather than one extra query per message.
        names = dict(self.db.query(User.id, User.display_name).filter(User.id.in_({m.sender_id for m in rows})).all())
        for message in rows:
            message.sender_name = names.get(message.sender_id, 'Former member')
        return rows if after_id is not None else list(reversed(rows))

    def get_direct_messages(self, user_id: int, other_user_id: int, limit=50, before_id=None, after_id=None) -> list[Message]:
        self.require_user(other_user_id)
        return self._message_page(
            self.db.query(Message)
            .filter(
                or_(
                    and_(Message.sender_id == user_id, Message.recipient_id == other_user_id),
                    and_(Message.sender_id == other_user_id, Message.recipient_id == user_id),
                )
            )
            , limit, before_id, after_id
        )

    def get_group_messages(self, group_id: int, user_id: int, limit=50, before_id=None, after_id=None) -> list[Message]:
        self.require_member(user_id, group_id)
        from app.routers.safety import blocked_ids
        return self._message_page(
            self.db.query(Message)
            .filter(Message.group_id == group_id)
            .filter(~Message.sender_id.in_(blocked_ids(self.db, user_id)))
            , limit, before_id, after_id
        )
