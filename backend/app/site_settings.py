from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Integer, String, Text, Boolean, CheckConstraint
from sqlalchemy.orm import Session, Mapped, mapped_column
from pydantic import BaseModel
from app.db.base import Base
from app.db.session import get_db
from app.core.deps import require_superadmin, get_current_user
from app.models import User

router = APIRouter(prefix="/site-settings", tags=["site-settings"])

DEFAULT_PAGES = [
    {"slug": "about", "label": "About", "order": 1},
    {"slug": "services", "label": "Services", "order": 2},
    {"slug": "our-partners", "label": "Our Partners", "order": 3},
    {"slug": "get-a-quote", "label": "Get a Quote", "order": 4},
    {"slug": "track-shipment", "label": "Track Shipment", "order": 5},
    {"slug": "latest-news", "label": "Latest News", "order": 6},
    {"slug": "careers", "label": "Careers", "order": 7},
    {"slug": "contact", "label": "Contact", "order": 8},
]

DEFAULT_SETTINGS = {
    "site_info.company_name": "Prismma Express Sdn Bhd",
    "site_info.email": "enquiry@prismma.net",
    "site_info.phone": "+6 010 660 6600\n+6 016 850 4340",
    "site_info.address": "NO. 736, Lorong Perindustrian Bukit Minyak 11, Kawasan Bukit Minyak, 14100 Simpang Ampat, Pulau Pinang, MALAYSIA.",
    "system.inactivity_timeout_minutes": "60",
    "system.inactivity_warning_seconds": "60",
    "system.login_max_attempts": "5",
    "system.lockout_stage1_minutes": "15",
    "system.lockout_stage2_minutes": "30",
    "system.registration_enabled": "true",
    "maintenance.enabled": "false",
    "maintenance.message": "We'll be back shortly. Thanks for your patience.",
}


class HomepagePage(Base):
    __tablename__ = "homepage_pages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class SiteLink(Base):
    __tablename__ = "site_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (
        CheckConstraint("type IN ('social', 'footer')", name="site_links_type_check"),
    )


class SiteSetting(Base):
    __tablename__ = "site_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(nullable=True, default=datetime.utcnow, onupdate=datetime.utcnow)


def _ensure_seeded(db: Session) -> None:
    if db.query(HomepagePage).first() is None:
        for p in DEFAULT_PAGES:
            db.add(HomepagePage(**p))
    existing_keys = {row.key for row in db.query(SiteSetting).all()}
    for key, value in DEFAULT_SETTINGS.items():
        if key not in existing_keys:
            db.add(SiteSetting(key=key, value=value))
    db.commit()


def _get_setting(db: Session, key: str, default: str = "") -> str:
    row = db.query(SiteSetting).filter(SiteSetting.key == key).first()
    return row.value if row and row.value is not None else default


class PageRead(BaseModel):
    id: int
    slug: str
    label: str
    visible: bool
    order: int

    class Config:
        from_attributes = True


class PageUpdate(BaseModel):
    visible: bool


class LinkCreate(BaseModel):
    type: str
    label: str
    url: str
    order: int = 0


class LinkUpdate(BaseModel):
    label: str | None = None
    url: str | None = None
    order: int | None = None


class LinkRead(BaseModel):
    id: int
    type: str
    label: str
    url: str
    order: int

    class Config:
        from_attributes = True


class ConfigRead(BaseModel):
    settings: dict[str, str]


class ConfigUpdate(BaseModel):
    settings: dict[str, str]


class MaintenanceRead(BaseModel):
    enabled: bool
    message: str


class SessionConfigRead(BaseModel):
    inactivity_timeout_minutes: int
    inactivity_warning_seconds: int


# --- Admin management, superadmin only ---

@router.get("/pages", response_model=list[PageRead])
def list_pages(db: Session = Depends(get_db), current_user: User = Depends(require_superadmin)):
    _ensure_seeded(db)
    return db.query(HomepagePage).order_by(HomepagePage.order).all()


@router.patch("/pages/{page_id}", response_model=PageRead)
def update_page(
    page_id: int,
    payload: PageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    page = db.query(HomepagePage).filter(HomepagePage.id == page_id).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    page.visible = payload.visible
    db.commit()
    db.refresh(page)
    return page


@router.get("/links", response_model=list[LinkRead])
def list_links(
    type: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    query = db.query(SiteLink)
    if type:
        query = query.filter(SiteLink.type == type)
    return query.order_by(SiteLink.order).all()


@router.post("/links", response_model=LinkRead)
def create_link(
    payload: LinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    if payload.type not in ("social", "footer"):
        raise HTTPException(status_code=400, detail="Type must be 'social' or 'footer'")
    link = SiteLink(**payload.model_dump())
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.patch("/links/{link_id}", response_model=LinkRead)
def update_link(
    link_id: int,
    payload: LinkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    link = db.query(SiteLink).filter(SiteLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(link, field, value)
    db.commit()
    db.refresh(link)
    return link


@router.delete("/links/{link_id}")
def delete_link(
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    link = db.query(SiteLink).filter(SiteLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    db.delete(link)
    db.commit()
    return {"deleted": True}


@router.get("/config", response_model=ConfigRead)
def get_config(db: Session = Depends(get_db), current_user: User = Depends(require_superadmin)):
    _ensure_seeded(db)
    rows = db.query(SiteSetting).all()
    return ConfigRead(settings={r.key: r.value or "" for r in rows})


@router.patch("/config", response_model=ConfigRead)
def update_config(
    payload: ConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin),
):
    for key, value in payload.settings.items():
        if key not in DEFAULT_SETTINGS:
            raise HTTPException(status_code=400, detail=f"Unknown setting: {key}")
        row = db.query(SiteSetting).filter(SiteSetting.key == key).first()
        if row:
            row.value = value
        else:
            db.add(SiteSetting(key=key, value=value))
    db.commit()
    rows = db.query(SiteSetting).all()
    return ConfigRead(settings={r.key: r.value or "" for r in rows})


# --- Authenticated, any logged-in user, needed by InactivityMonitor ---

@router.get("/session-config", response_model=SessionConfigRead)
def get_session_config(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    _ensure_seeded(db)
    return SessionConfigRead(
        inactivity_timeout_minutes=int(_get_setting(db, "system.inactivity_timeout_minutes", "60")),
        inactivity_warning_seconds=int(_get_setting(db, "system.inactivity_warning_seconds", "60")),
    )


# --- Fully public, no auth, used by the homepage and by system's pre-login pages ---

@router.get("/public/nav")
def public_nav(db: Session = Depends(get_db)):
    _ensure_seeded(db)
    pages = db.query(HomepagePage).filter(HomepagePage.visible == True).order_by(HomepagePage.order).all()
    return [{"slug": p.slug, "label": p.label} for p in pages]


@router.get("/public/site-info")
def public_site_info(db: Session = Depends(get_db)):
    _ensure_seeded(db)
    return {
        "company_name": _get_setting(db, "site_info.company_name"),
        "email": _get_setting(db, "site_info.email"),
        "phone": _get_setting(db, "site_info.phone"),
        "address": _get_setting(db, "site_info.address"),
    }


@router.get("/public/links", response_model=list[LinkRead])
def public_links(type: str | None = None, db: Session = Depends(get_db)):
    query = db.query(SiteLink)
    if type:
        query = query.filter(SiteLink.type == type)
    return query.order_by(SiteLink.order).all()


@router.get("/public/maintenance", response_model=MaintenanceRead)
def public_maintenance(db: Session = Depends(get_db)):
    _ensure_seeded(db)
    return MaintenanceRead(
        enabled=_get_setting(db, "maintenance.enabled", "false") == "true",
        message=_get_setting(db, "maintenance.message"),
    )


@router.get("/public/registration-enabled")
def public_registration_enabled(db: Session = Depends(get_db)):
    _ensure_seeded(db)
    return {"enabled": _get_setting(db, "system.registration_enabled", "true") == "true"}
