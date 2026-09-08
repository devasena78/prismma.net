from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Integer, String, Text, Boolean, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import Session, Mapped, mapped_column, relationship, aliased
from pydantic import BaseModel
from app.db.base import Base
from app.db.session import get_db
from app.core.deps import require_module_access, require_superadmin
from app.core.module_log import log_module_action
from app.models import User, Department, ModuleActionLog

router = APIRouter(prefix="/assets", tags=["assets"])

VALID_STATUSES = {"in_use", "in_storage", "under_repair", "disposed", "to_be_announced"}
ADMIN_EDITABLE_FIELDS = {"name", "description", "category_id", "location"}
SUPERADMIN_ONLY_FIELDS = {"status", "serial_code"}


class AssetCategory(Base):
    __tablename__ = "asset_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.utcnow)


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    tag_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[int] = mapped_column(Integer, ForeignKey("asset_categories.id", ondelete="RESTRICT"), nullable=False)
    serial_code: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="in_storage")
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    year_manufactured: Mapped[int | None] = mapped_column(Integer, nullable=True)
    assigned_person_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_department_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    category: Mapped[AssetCategory] = relationship("AssetCategory", foreign_keys=[category_id])
    assigned_person: Mapped[User | None] = relationship("User", foreign_keys=[assigned_person_id])
    assigned_department: Mapped[Department | None] = relationship("Department", foreign_keys=[assigned_department_id])
    notes: Mapped[list["AssetNote"]] = relationship(
        "AssetNote", back_populates="asset", cascade="all, delete-orphan", order_by="AssetNote.created_at.desc()"
    )
    photos: Mapped[list["AssetPhoto"]] = relationship(
        "AssetPhoto", cascade="all, delete-orphan", order_by="AssetPhoto.order"
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('in_use', 'in_storage', 'under_repair', 'disposed', 'to_be_announced')",
            name="assets_status_check",
        ),
    )


class AssetPhoto(Base):
    __tablename__ = "asset_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    asset_id: Mapped[int] = mapped_column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.utcnow)


class AssetNote(Base):
    __tablename__ = "asset_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    asset_id: Mapped[int] = mapped_column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    author_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    edited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    author: Mapped[User] = relationship("User", foreign_keys=[author_id])
    asset: Mapped[Asset] = relationship("Asset", back_populates="notes", foreign_keys=[asset_id])


class AssetSubmission(Base):
    __tablename__ = "asset_submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    asset_id: Mapped[int] = mapped_column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    returned_by_person_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    returned_by_department_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    proposed_status: Mapped[str] = mapped_column(String(30), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    final_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.utcnow)

    asset: Mapped[Asset] = relationship("Asset", foreign_keys=[asset_id])
    returned_by_person: Mapped[User | None] = relationship("User", foreign_keys=[returned_by_person_id])
    returned_by_department: Mapped[Department | None] = relationship("Department", foreign_keys=[returned_by_department_id])
    submitter: Mapped[User] = relationship("User", foreign_keys=[submitted_by])
    reviewer: Mapped[User | None] = relationship("User", foreign_keys=[reviewed_by])

    __table_args__ = (
        CheckConstraint("status IN ('pending', 'reviewed')", name="asset_submissions_status_check"),
        CheckConstraint(
            "proposed_status IN ('in_use', 'in_storage', 'under_repair', 'disposed', 'to_be_announced')",
            name="asset_submissions_proposed_status_check",
        ),
        CheckConstraint(
            "final_status IS NULL OR final_status IN ('in_use', 'in_storage', 'under_repair', 'disposed', 'to_be_announced')",
            name="asset_submissions_final_status_check",
        ),
    )
    photos: Mapped[list["SubmissionPhoto"]] = relationship(
        "SubmissionPhoto", cascade="all, delete-orphan", order_by="SubmissionPhoto.order"
    )


class SubmissionPhoto(Base):
    __tablename__ = "submission_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    submission_id: Mapped[int] = mapped_column(Integer, ForeignKey("asset_submissions.id", ondelete="CASCADE"), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=datetime.utcnow)


def require_asset_access(user: User = Depends(require_module_access("asset-tagging"))) -> User:
    return user


def require_asset_admin(user: User = Depends(require_module_access("asset-tagging"))) -> User:
    if user.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Admin access required within Asset Tagging")
    return user


def require_asset_superadmin(user: User = Depends(require_asset_admin)) -> User:
    if user.role != "superadmin":
        raise HTTPException(status_code=403, detail="Superadmin access required for this action")
    return user


class AssetCategoryCreate(BaseModel):
    name: str


class AssetCategoryRead(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class AssetNoteCreate(BaseModel):
    content: str


class AssetNoteUpdate(BaseModel):
    content: str


class AssetNoteRead(BaseModel):
    id: int
    content: str
    author_id: int
    author_name: str
    created_at: datetime | None
    updated_at: datetime | None
    edited: bool


class AssetCreate(BaseModel):
    name: str
    description: str | None = None
    photo_urls: list[str] = []
    category_id: int
    serial_code: str
    status: str = "in_storage"
    location: str | None = None
    year_manufactured: int | None = None


class AssetUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    photo_urls: list[str] | None = None
    category_id: int | None = None
    serial_code: str | None = None
    status: str | None = None
    location: str | None = None
    year_manufactured: int | None = None


class AssignPayload(BaseModel):
    assigned_person_id: int | None = None
    assigned_department_id: int | None = None
    status: str | None = None


class AssetRead(BaseModel):
    id: int
    tag_id: str
    name: str
    description: str | None
    photos: list[str]
    category_id: int
    category_name: str
    serial_code: str
    status: str
    location: str | None
    year_manufactured: int | None
    assigned_person_id: int | None
    assigned_person_name: str | None
    assigned_department_id: int | None
    assigned_department_name: str | None
    created_at: datetime | None
    updated_at: datetime | None


class AssetDetailRead(AssetRead):
    notes: list[AssetNoteRead]


class SubmissionCreate(BaseModel):
    proposed_status: str
    detail: str | None = None
    photo_urls: list[str] = []


class SubmissionReview(BaseModel):
    final_status: str


class SubmissionRead(BaseModel):
    id: int
    asset_id: int
    asset_name: str
    asset_tag_id: str
    returned_by_person_name: str | None
    returned_by_department_name: str | None
    proposed_status: str
    detail: str | None
    photos: list[str]
    submitted_by_name: str
    status: str
    final_status: str | None
    reviewed_by_name: str | None
    reviewed_at: datetime | None
    created_at: datetime | None


class UserAssetSummary(BaseModel):
    user_id: int
    user_name: str
    department_name: str | None
    asset_count: int


def _serialize_asset(asset: Asset) -> AssetRead:
    return AssetRead(
        id=asset.id,
        tag_id=asset.tag_id,
        name=asset.name,
        description=asset.description,
        photos=[p.url for p in asset.photos],
        category_id=asset.category_id,
        category_name=asset.category.name,
        serial_code=asset.serial_code,
        status=asset.status,
        location=asset.location,
        year_manufactured=asset.year_manufactured,
        assigned_person_id=asset.assigned_person_id,
        assigned_person_name=asset.assigned_person.name if asset.assigned_person else None,
        assigned_department_id=asset.assigned_department_id,
        assigned_department_name=asset.assigned_department.name if asset.assigned_department else None,
        created_at=asset.created_at,
        updated_at=asset.updated_at,
    )


def _serialize_note(note: AssetNote) -> AssetNoteRead:
    return AssetNoteRead(
        id=note.id,
        content=note.content,
        author_id=note.author_id,
        author_name=note.author.name,
        created_at=note.created_at,
        updated_at=note.updated_at,
        edited=note.edited,
    )


def _serialize_submission(s: AssetSubmission) -> SubmissionRead:
    return SubmissionRead(
        id=s.id,
        asset_id=s.asset_id,
        asset_name=s.asset.name,
        asset_tag_id=s.asset.tag_id,
        returned_by_person_name=s.returned_by_person.name if s.returned_by_person else None,
        returned_by_department_name=s.returned_by_department.name if s.returned_by_department else None,
        proposed_status=s.proposed_status,
        detail=s.detail,
        photos=[p.url for p in s.photos],
        submitted_by_name=s.submitter.name,
        status=s.status,
        final_status=s.final_status,
        reviewed_by_name=s.reviewer.name if s.reviewer else None,
        reviewed_at=s.reviewed_at,
        created_at=s.created_at,
    )


def _check_serial_unique(db: Session, serial_code: str, exclude_id: int | None = None) -> None:
    query = db.query(Asset).filter(Asset.serial_code == serial_code)
    if exclude_id:
        query = query.filter(Asset.id != exclude_id)
    existing = query.first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail={
                "message": f"This serial code is already used by {existing.name} ({existing.tag_id}).",
                "conflicting_asset_id": existing.id,
                "conflicting_asset_tag_id": existing.tag_id,
            },
        )


@router.get("/categories", response_model=list[AssetCategoryRead])
def list_categories(db: Session = Depends(get_db), current_user: User = Depends(require_asset_access)):
    return db.query(AssetCategory).order_by(AssetCategory.name).all()


@router.post("/categories", response_model=AssetCategoryRead)
def create_category(
    payload: AssetCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_asset_admin),
):
    existing = db.query(AssetCategory).filter(AssetCategory.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category already exists")
    category = AssetCategory(name=payload.name, created_by=current_user.id)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_asset_admin),
):
    category = db.query(AssetCategory).filter(AssetCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    in_use = db.query(Asset).filter(Asset.category_id == category_id).first()
    if in_use:
        raise HTTPException(status_code=400, detail="Cannot remove a category that's still assigned to assets")
    db.delete(category)
    db.commit()
    return {"deleted": True}


@router.get("/users-summary", response_model=list[UserAssetSummary])
def users_summary(db: Session = Depends(get_db), current_user: User = Depends(require_asset_access)):
    from sqlalchemy import func

    counts_subq = (
        db.query(Asset.assigned_person_id, func.count(Asset.id).label("cnt"))
        .filter(Asset.assigned_person_id.isnot(None))
        .group_by(Asset.assigned_person_id)
        .subquery()
    )

    Dept = aliased(Department)
    rows = (
        db.query(User, Dept, counts_subq.c.cnt)
        .join(counts_subq, counts_subq.c.assigned_person_id == User.id)
        .outerjoin(Dept, User.department_id == Dept.id)
        .filter(User.account_status == "active")
        .all()
    )
    result = [
        UserAssetSummary(user_id=user.id, user_name=user.name, department_name=dept.name if dept else None, asset_count=cnt)
        for user, dept, cnt in rows
    ]
    result.sort(key=lambda r: r.asset_count, reverse=True)
    return result


@router.get("", response_model=list[AssetRead])
def list_assets(
    limit: int = 200,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_asset_access),
):
    limit = min(max(limit, 1), 500)
    assets = db.query(Asset).order_by(Asset.created_at.desc()).limit(limit).offset(offset).all()
    return [_serialize_asset(a) for a in assets]


@router.get("/{asset_id}", response_model=AssetDetailRead)
def get_asset(asset_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_asset_access)):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    base = _serialize_asset(asset)
    notes = [_serialize_note(n) for n in asset.notes]
    return AssetDetailRead(**base.model_dump(), notes=notes)


@router.get("/{asset_id}/history")
def get_asset_history(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_asset_admin),
):
    Actor = aliased(User)
    rows = (
        db.query(ModuleActionLog, Actor)
        .outerjoin(Actor, ModuleActionLog.performed_by == Actor.id)
        .filter(ModuleActionLog.module == "asset-tagging", ModuleActionLog.target_id == asset_id)
        .order_by(ModuleActionLog.created_at.desc())
        .all()
    )
    return [
        {
            "id": log.id,
            "action": log.action,
            "detail": log.detail,
            "actor_name": actor.name if actor else None,
            "created_at": log.created_at,
        }
        for log, actor in rows
    ]


@router.post("", response_model=AssetRead)
def create_asset(
    payload: AssetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_asset_superadmin),
):
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    if payload.status == "in_use":
        raise HTTPException(status_code=400, detail="A new asset can't be created as In Use, assign it to a person or department instead.")
    category = db.query(AssetCategory).filter(AssetCategory.id == payload.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    _check_serial_unique(db, payload.serial_code)

    asset = Asset(
        tag_id="",
        name=payload.name,
        description=payload.description,
        category_id=payload.category_id,
        serial_code=payload.serial_code,
        status=payload.status,
        location=payload.location,
        year_manufactured=payload.year_manufactured,
        created_by=current_user.id,
    )
    db.add(asset)
    db.flush()
    asset.tag_id = f"AST-{asset.id:06d}"
    for i, url in enumerate(payload.photo_urls):
        db.add(AssetPhoto(asset_id=asset.id, url=url, order=i))
    log_module_action(db, "asset-tagging", asset.name, "asset_created", current_user.id, target_id=asset.id)
    db.commit()
    db.refresh(asset)
    return _serialize_asset(asset)


@router.patch("/{asset_id}", response_model=AssetRead)
def update_asset(
    asset_id: int,
    payload: AssetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_asset_admin),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    update_data = payload.model_dump(exclude_unset=True)

    attempted_restricted = SUPERADMIN_ONLY_FIELDS & set(update_data.keys())
    if attempted_restricted and current_user.role != "superadmin":
        raise HTTPException(
            status_code=403,
            detail=f"Only a superadmin can change: {', '.join(sorted(attempted_restricted))}",
        )

    if "status" in update_data and update_data["status"] not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    if "status" in update_data and update_data["status"] == "in_use":
        raise HTTPException(status_code=400, detail="Setting status to In Use directly isn't allowed, assign this asset to a person or department instead.")
    if "status" in update_data and asset.status == "in_use":
        raise HTTPException(status_code=400, detail="This asset is currently in use. Report a return through Submissions before changing its status.")
    if "category_id" in update_data:
        category = db.query(AssetCategory).filter(AssetCategory.id == update_data["category_id"]).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
    if "serial_code" in update_data:
        _check_serial_unique(db, update_data["serial_code"], exclude_id=asset.id)

    photo_urls = update_data.pop("photo_urls", None)
    if photo_urls is not None:
        db.query(AssetPhoto).filter(AssetPhoto.asset_id == asset.id).delete()
        for i, url in enumerate(photo_urls):
            db.add(AssetPhoto(asset_id=asset.id, url=url, order=i))

    for field, value in update_data.items():
        setattr(asset, field, value)

    log_module_action(db, "asset-tagging", asset.name, "asset_updated", current_user.id, target_id=asset.id)
    db.commit()
    db.refresh(asset)
    return _serialize_asset(asset)


@router.post("/{asset_id}/assign", response_model=AssetRead)
def assign_asset(
    asset_id: int,
    payload: AssignPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_asset_admin),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if asset.status == "in_use":
        raise HTTPException(
            status_code=400,
            detail="This asset is currently in use. Report a return through Submissions before reassigning it.",
        )
    if asset.status == "disposed":
        raise HTTPException(status_code=400, detail="This asset has been disposed and can no longer be assigned.")

    if payload.assigned_person_id is None and payload.assigned_department_id is None:
        raise HTTPException(status_code=400, detail="Pick a person, a department, or both, at least one is required")

    is_assigning = payload.assigned_person_id is not None or payload.assigned_department_id is not None

    if payload.status is not None:
        if payload.status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid status")
        asset.status = payload.status
    elif is_assigning:
        asset.status = "in_use"

    asset.assigned_person_id = payload.assigned_person_id
    asset.assigned_department_id = payload.assigned_department_id

    who = []
    if payload.assigned_person_id:
        person = db.query(User).filter(User.id == payload.assigned_person_id).first()
        if person:
            who.append(person.name)
    if payload.assigned_department_id:
        dept = db.query(Department).filter(Department.id == payload.assigned_department_id).first()
        if dept:
            who.append(dept.name)
    detail = f"Assigned to {', '.join(who)}" if who else "Unassigned"

    log_module_action(db, "asset-tagging", asset.name, "asset_assigned", current_user.id, detail=detail, target_id=asset.id)
    db.commit()
    db.refresh(asset)
    return _serialize_asset(asset)


@router.post("/{asset_id}/notes", response_model=AssetNoteRead)
def add_note(
    asset_id: int,
    payload: AssetNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_asset_access),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    note = AssetNote(asset_id=asset_id, content=payload.content, author_id=current_user.id)
    db.add(note)
    log_module_action(db, "asset-tagging", asset.name, "note_added", current_user.id, detail=payload.content, target_id=asset.id)
    db.commit()
    db.refresh(note)
    return _serialize_note(note)


@router.patch("/notes/{note_id}", response_model=AssetNoteRead)
def edit_note(
    note_id: int,
    payload: AssetNoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_asset_access),
):
    note = db.query(AssetNote).filter(AssetNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    is_owner = note.author_id == current_user.id
    is_admin_tier = current_user.role in ("admin", "superadmin")
    if not is_owner and not is_admin_tier:
        raise HTTPException(status_code=403, detail="You can only edit your own notes")

    old_content = note.content
    note.content = payload.content
    note.edited = True
    log_module_action(
        db, "asset-tagging", note.asset.name, "note_edited", current_user.id,
        detail=f"From: {old_content}\nTo: {payload.content}", target_id=note.asset_id,
    )
    db.commit()
    db.refresh(note)
    return _serialize_note(note)


@router.delete("/notes/{note_id}")
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_asset_admin),
):
    note = db.query(AssetNote).filter(AssetNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    asset_id = note.asset_id
    asset_name = note.asset.name
    content = note.content
    db.delete(note)
    log_module_action(db, "asset-tagging", asset_name, "note_deleted", current_user.id, detail=content, target_id=asset_id)
    db.commit()
    return {"deleted": True}


@router.post("/{asset_id}/submissions", response_model=SubmissionRead)
def create_submission(
    asset_id: int,
    payload: SubmissionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_asset_admin),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if payload.proposed_status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    if payload.proposed_status == "in_use":
        raise HTTPException(status_code=400, detail="A submission can't propose In Use, assign the asset to a person or department through Assign instead.")

    submission = AssetSubmission(
        asset_id=asset_id,
        returned_by_person_id=asset.assigned_person_id,
        returned_by_department_id=asset.assigned_department_id,
        proposed_status=payload.proposed_status,
        detail=payload.detail,
        submitted_by=current_user.id,
        status="pending",
    )
    db.add(submission)
    db.flush()
    for i, url in enumerate(payload.photo_urls):
        db.add(SubmissionPhoto(submission_id=submission.id, url=url, order=i))

    asset.assigned_person_id = None
    asset.assigned_department_id = None

    log_module_action(
        db, "asset-tagging", asset.name, "submission_created", current_user.id,
        detail=f"Proposed: {payload.proposed_status}", target_id=asset_id,
    )
    db.commit()
    db.refresh(submission)
    return _serialize_submission(submission)


@router.get("/submissions/list", response_model=list[SubmissionRead])
def list_submissions(
    status: str | None = None,
    limit: int = 200,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_asset_admin),
):
    limit = min(max(limit, 1), 500)
    query = db.query(AssetSubmission)
    if status:
        query = query.filter(AssetSubmission.status == status)
    submissions = query.order_by(AssetSubmission.created_at.desc()).limit(limit).offset(offset).all()
    return [_serialize_submission(s) for s in submissions]


@router.post("/submissions/{submission_id}/review", response_model=SubmissionRead)
def review_submission(
    submission_id: int,
    payload: SubmissionReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_asset_superadmin),
):
    submission = db.query(AssetSubmission).filter(AssetSubmission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    if submission.status == "reviewed":
        raise HTTPException(status_code=400, detail="This submission has already been reviewed")
    if payload.final_status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    if payload.final_status == "in_use":
        raise HTTPException(status_code=400, detail="A submission can't be finalized as In Use, assign the asset to a person or department through Assign instead.")

    asset = db.query(Asset).filter(Asset.id == submission.asset_id).first()
    if asset:
        asset.status = payload.final_status

    submission.status = "reviewed"
    submission.final_status = payload.final_status
    submission.reviewed_by = current_user.id
    submission.reviewed_at = datetime.utcnow()

    log_module_action(
        db, "asset-tagging", asset.name if asset else "Unknown", "submission_reviewed", current_user.id,
        detail=f"Finalized as: {payload.final_status}", target_id=submission.asset_id,
    )
    db.commit()
    db.refresh(submission)
    return _serialize_submission(submission)
