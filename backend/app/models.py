from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    LargeBinary,
    Column,
    DateTime,
    ForeignKey,
    Float,
    Integer,
    Index,
    JSON,
    String,
    Table,
    Text,
    UniqueConstraint,
    Enum
)
from sqlalchemy.orm import relationship
import enum

from .database import Base


def utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


class PublishedCampusRoute(Base):
    __tablename__ = "published_campus_routes"
    __table_args__ = (UniqueConstraint("route_key", "revision"),)
    id = Column(Integer, primary_key=True)
    route_key = Column(String(24), nullable=False, index=True)
    revision = Column(Integer, nullable=False)
    metadata_json = Column(Text, nullable=False)
    package = Column(LargeBinary, nullable=False)
    editor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)


class PublishedHomeRoute(Base):
    """Append-only history. Home coordinates must never replace campus routes."""
    __tablename__ = "published_home_routes"
    __table_args__ = (UniqueConstraint("destination", "revision"),)
    id = Column(Integer, primary_key=True)
    destination = Column(String(80), nullable=False, index=True)
    revision = Column(Integer, nullable=False)
    points_json = Column(Text, nullable=False)
    editor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)


programme_careers = Table(
    "programme_careers",
    Base.metadata,
    Column(
        "programme_id",
        ForeignKey("programmes.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "career_id",
        ForeignKey("careers.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


wayfinding_destination_doors = Table(
    "wayfinding_destination_doors",
    Base.metadata,
    Column(
        "destination_id",
        ForeignKey("wayfinding_destinations.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "location_id",
        ForeignKey("wayfinding_locations.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Programme(Base):
    __tablename__ = "programmes"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(255), nullable=False, index=True)

    faculty = Column(String(255))

    description = Column(Text)

    duration = Column(String(100))

    entry_requirements = Column(Text)

    career_pathways = Column(Text)

    programme_url = Column(String(1000), index=True)

    image_url = Column(String(1000))

    careers = relationship(
        "Career",
        secondary=programme_careers,
        back_populates="programmes",
        order_by="Career.name",
    )
    milestones = relationship(
        "ProgrammeMilestone",
        back_populates="programme",
        cascade="all, delete-orphan",
        order_by="ProgrammeMilestone.sort_order",
    )


class Career(Base):
    __tablename__ = "careers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    description = Column(Text)
    official_url = Column(String(1000))

    programmes = relationship(
        "Programme",
        secondary=programme_careers,
        back_populates="careers",
        order_by="Programme.name",
    )


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(320), nullable=False, unique=True, index=True)
    password_hash = Column(String(500), nullable=False)
    display_name = Column(String(100), nullable=False)
    created_at = Column(DateTime, nullable=False, default=utc_now)

    sessions = relationship(
        "AuthSession",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    profile = relationship(
        "StudentProfile",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    journey_preference = relationship(
        "StudentJourneyPreference",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    milestone_progress = relationship(
        "StudentMilestoneProgress",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    personalisation = relationship(
        "StudentPersonalisation",
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    attributes = relationship(
        "StudentAttribute",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    courses = relationship(
        "StudentCourse",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    saved_programmes = relationship(
        "SavedProgramme",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    saved_careers = relationship(
        "SavedCareer",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = Column(Integer, primary_key=True)
    user_id = Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, default=utc_now)

    user = relationship("User", back_populates="sessions")


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    programme_id = Column(ForeignKey("programmes.id"))
    current_stage = Column(Integer)
    catalogue_year = Column(Integer)

    user = relationship("User", back_populates="profile")
    programme = relationship("Programme")


class StudentPersonalisation(Base):
    __tablename__ = "student_personalisations"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    bio = Column(Text)
    study_mode = Column(String(30))
    study_style = Column(String(50))
    preferred_group_size = Column(Integer)
    availability = Column(String(500))
    matching_enabled = Column(Boolean, nullable=False, default=False)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="personalisation")


class StudentAttribute(Base):
    __tablename__ = "student_attributes"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "kind",
            "normalised_value",
            name="uq_student_attribute",
        ),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String(30), nullable=False, index=True)
    value = Column(String(100), nullable=False)
    normalised_value = Column(String(100), nullable=False, index=True)

    user = relationship("User", back_populates="attributes")


class StudentCourse(Base):
    __tablename__ = "student_courses"
    __table_args__ = (
        UniqueConstraint("user_id", "course_code", name="uq_student_course"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_code = Column(String(30), nullable=False, index=True)
    course_name = Column(String(255))
    semester = Column(String(30))
    academic_year = Column(Integer)

    user = relationship("User", back_populates="courses")


class SavedProgramme(Base):
    __tablename__ = "saved_programmes"
    __table_args__ = (
        UniqueConstraint("user_id", "programme_id", name="uq_saved_programme"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    programme_id = Column(ForeignKey("programmes.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)

    user = relationship("User", back_populates="saved_programmes")
    programme = relationship("Programme")


class SavedCareer(Base):
    __tablename__ = "saved_careers"
    __table_args__ = (
        UniqueConstraint("user_id", "career_id", name="uq_saved_career"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    career_id = Column(ForeignKey("careers.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)

    user = relationship("User", back_populates="saved_careers")
    career = relationship("Career")


class StudentJourneyPreference(Base):
    __tablename__ = "student_journey_preferences"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    plan_code = Column(String(50), nullable=False)

    user = relationship("User", back_populates="journey_preference")


class ProgrammeMilestone(Base):
    __tablename__ = "programme_milestones"
    __table_args__ = (
        UniqueConstraint(
            "programme_id",
            "catalogue_year",
            "code",
            name="uq_programme_milestone_version",
        ),
    )

    id = Column(Integer, primary_key=True)
    programme_id = Column(
        ForeignKey("programmes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    catalogue_year = Column(Integer, nullable=False)
    code = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    stage = Column(Integer)
    category = Column(String(50), nullable=False, default="requirement")
    points = Column(Integer, nullable=False, default=0)
    required = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)
    official_url = Column(String(1000))

    programme = relationship("Programme", back_populates="milestones")
    progress_records = relationship(
        "StudentMilestoneProgress",
        back_populates="milestone",
        cascade="all, delete-orphan",
    )


class StudentMilestoneProgress(Base):
    __tablename__ = "student_milestone_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "milestone_id", name="uq_user_milestone"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    milestone_id = Column(
        ForeignKey("programme_milestones.id", ondelete="CASCADE"),
        nullable=False,
    )
    completed = Column(Boolean, nullable=False, default=False)
    completed_at = Column(DateTime)

    user = relationship("User", back_populates="milestone_progress")
    milestone = relationship("ProgrammeMilestone", back_populates="progress_records")


class Campus(Base):
    __tablename__ = "campuses"

    id = Column(Integer, primary_key=True)
    code = Column(String(30), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    address = Column(String(500))
    latitude = Column(Float)
    longitude = Column(Float)
    official_map_url = Column(String(1000))
    active = Column(Boolean, nullable=False, default=True)

    buildings = relationship(
        "Building",
        back_populates="campus",
        cascade="all, delete-orphan",
        order_by="Building.number",
    )
    locations = relationship("WayfindingLocation", back_populates="campus")


class Building(Base):
    __tablename__ = "buildings"
    __table_args__ = (
        UniqueConstraint("campus_id", "number", name="uq_campus_building_number"),
    )

    id = Column(Integer, primary_key=True)
    campus_id = Column(ForeignKey("campuses.id", ondelete="CASCADE"), nullable=False, index=True)
    number = Column(String(30), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    address = Column(String(500))
    latitude = Column(Float)
    longitude = Column(Float)
    image_url = Column(String(1000))
    accessible = Column(Boolean, nullable=False, default=True)
    data_status = Column(String(30), nullable=False, default="demo")
    official_url = Column(String(1000))

    campus = relationship("Campus", back_populates="buildings")
    floors = relationship(
        "BuildingFloor",
        back_populates="building",
        cascade="all, delete-orphan",
        order_by="BuildingFloor.sort_order",
    )
    locations = relationship("WayfindingLocation", back_populates="building")
    destinations = relationship(
        "WayfindingDestination",
        back_populates="building",
        cascade="all, delete-orphan",
        order_by="WayfindingDestination.code",
    )


class BuildingFloor(Base):
    __tablename__ = "building_floors"
    __table_args__ = (
        UniqueConstraint("building_id", "level", name="uq_building_floor_level"),
    )

    id = Column(Integer, primary_key=True)
    building_id = Column(ForeignKey("buildings.id", ondelete="CASCADE"), nullable=False, index=True)
    level = Column(Integer, nullable=False)
    label = Column(String(50), nullable=False)
    name = Column(String(100))
    sort_order = Column(Integer, nullable=False, default=0)
    floorplan_url = Column(String(1000))
    data_status = Column(String(30), nullable=False, default="demo")

    building = relationship("Building", back_populates="floors")
    locations = relationship("WayfindingLocation", back_populates="floor")
    destinations = relationship(
        "WayfindingDestination",
        back_populates="floor",
        order_by="WayfindingDestination.code",
    )


class WayfindingLocation(Base):
    __tablename__ = "wayfinding_locations"

    id = Column(Integer, primary_key=True)
    campus_id = Column(ForeignKey("campuses.id", ondelete="CASCADE"), nullable=False, index=True)
    building_id = Column(ForeignKey("buildings.id", ondelete="CASCADE"), index=True)
    floor_id = Column(ForeignKey("building_floors.id", ondelete="CASCADE"), index=True)
    code = Column(String(80), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    location_type = Column(String(50), nullable=False, index=True)
    description = Column(Text)
    latitude = Column(Float)
    longitude = Column(Float)
    x = Column(Float)
    y = Column(Float)
    accessible = Column(Boolean, nullable=False, default=True)
    verified = Column(Boolean, nullable=False, default=False)

    campus = relationship("Campus", back_populates="locations")
    building = relationship("Building", back_populates="locations")
    floor = relationship("BuildingFloor", back_populates="locations")
    destinations = relationship(
        "WayfindingDestination",
        secondary=wayfinding_destination_doors,
        back_populates="doors",
    )


class WayfindingDestination(Base):
    __tablename__ = "wayfinding_destinations"

    id = Column(Integer, primary_key=True)
    building_id = Column(
        ForeignKey("buildings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    floor_id = Column(
        ForeignKey("building_floors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code = Column(String(80), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    category = Column(String(50), nullable=False, default="room", index=True)
    search_terms = Column(Text)
    accessible = Column(Boolean, nullable=False, default=True)
    verified = Column(Boolean, nullable=False, default=False)

    building = relationship("Building", back_populates="destinations")
    floor = relationship("BuildingFloor", back_populates="destinations")
    doors = relationship(
        "WayfindingLocation",
        secondary=wayfinding_destination_doors,
        back_populates="destinations",
        order_by="WayfindingLocation.code",
    )


class WayfindingEdge(Base):
    __tablename__ = "wayfinding_edges"
    __table_args__ = (
        UniqueConstraint("from_location_id", "to_location_id", name="uq_wayfinding_edge"),
    )

    id = Column(Integer, primary_key=True)
    from_location_id = Column(ForeignKey("wayfinding_locations.id", ondelete="CASCADE"), nullable=False, index=True)
    to_location_id = Column(ForeignKey("wayfinding_locations.id", ondelete="CASCADE"), nullable=False, index=True)
    distance_m = Column(Float, nullable=False)
    instruction = Column(String(500))
    accessible = Column(Boolean, nullable=False, default=True)
    bidirectional = Column(Boolean, nullable=False, default=True)

    from_location = relationship("WayfindingLocation", foreign_keys=[from_location_id])
    to_location = relationship("WayfindingLocation", foreign_keys=[to_location_id])

#social stuff

class FriendshipStatus(enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"

class GroupRole(enum.Enum):
    MEMBER = "member"
    ADMIN = "admin"

class Friendship(Base):
    __tablename__ = "friendships"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    friend_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(Enum(FriendshipStatus), default=FriendshipStatus.PENDING, nullable=False)
    created_at = Column(DateTime, nullable=False, default=utc_now)

    __table_args__ = (
        UniqueConstraint("user_id", "friend_id", name="uq_user_friend"),
    )

class GroupMember(Base):
    __tablename__ = "group_members"

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(Enum(GroupRole), default=GroupRole.MEMBER, nullable=False)
    joined_at = Column(DateTime, nullable=False, default=utc_now)

    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_group_user"),
    )

class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    course = Column(String(100), nullable=False, default='', server_default='')
    description = Column(String(2000), nullable=False, default='', server_default='')
    group_type = Column(String(40), nullable=False, default='Other', server_default='Other')
    location = Column(String(200), nullable=False, default='', server_default='')
    study_format = Column(String(20), nullable=False, default='Hybrid', server_default='Hybrid')
    preferred_days = Column(JSON, nullable=False, default=list, server_default='[]')
    created_at = Column(DateTime, nullable=False, default=utc_now)

class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (Index('ix_messages_direct_page', 'sender_id', 'recipient_id', 'id'),
                      Index('ix_messages_group_page', 'group_id', 'id'))

    id = Column(Integer, primary_key=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Direct message
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)      # Group message
    content = Column(String(2000), nullable=False)
    created_at = Column(DateTime, nullable=False, default=utc_now)


class SavedGroup(Base):
    __tablename__ = 'saved_groups'
    user_id = Column(Integer, ForeignKey('users.id'), primary_key=True)
    group_id = Column(Integer, ForeignKey('groups.id'), primary_key=True)


class MessageRead(Base):
    __tablename__ = 'message_reads'
    user_id = Column(Integer, ForeignKey('users.id'), primary_key=True)
    message_id = Column(Integer, ForeignKey('messages.id'), primary_key=True)
    read_at = Column(DateTime, nullable=False, default=utc_now)


class BlockedUser(Base):
    __tablename__ = 'blocked_users'
    user_id = Column(Integer, ForeignKey('users.id'), primary_key=True)
    blocked_id = Column(Integer, ForeignKey('users.id'), primary_key=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)


class SafetyReport(Base):
    __tablename__ = 'safety_reports'
    id = Column(Integer, primary_key=True)
    reporter_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    message_id = Column(Integer, ForeignKey('messages.id'), nullable=True)
    reason = Column(String(2000), nullable=False)
    status = Column(String(20), nullable=False, default='open')
    created_at = Column(DateTime, nullable=False, default=utc_now)


class AccountEmailToken(Base):
    __tablename__ = 'account_email_tokens'
    token_hash = Column(String(64), primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    purpose = Column(String(20), nullable=False)
    expires_at = Column(DateTime, nullable=False)


class VerifiedEmail(Base):
    __tablename__ = 'verified_emails'
    user_id = Column(Integer, ForeignKey('users.id'), primary_key=True)
    verified_at = Column(DateTime, nullable=False, default=utc_now)


class NotificationPreference(Base):
    __tablename__ = 'notification_preferences'
    user_id = Column(Integer, ForeignKey('users.id'), primary_key=True)
    messages = Column(Boolean, nullable=False, default=True)
    friend_requests = Column(Boolean, nullable=False, default=True)


class RequestLimit(Base):
    __tablename__ = 'request_limits'
    key = Column(String(64), primary_key=True)
    window = Column(Integer, nullable=False)
    count = Column(Integer, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)


class DeletedAccount(Base):
    __tablename__ = 'deleted_accounts'
    user_id = Column(Integer, ForeignKey('users.id'), primary_key=True)
    deleted_at = Column(DateTime, nullable=False, default=utc_now)


class ProfilePhoto(Base):
    __tablename__ = 'profile_photos'
    user_id = Column(Integer, ForeignKey('users.id'), primary_key=True)
    image = Column(LargeBinary, nullable=False)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)
