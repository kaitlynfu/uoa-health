from fastapi import APIRouter, Depends

from app.models import User
from app.services.auth_service import get_current_user
from app.services.route_permissions import can_edit_routes

router = APIRouter(prefix="/navigation", tags=["Route editing"])


@router.get("/editor-access")
def editor_access(user: User = Depends(get_current_user)):
    # A permission grant does not imply the publishing workflow is available.
    return {"can_edit_routes": can_edit_routes(user), "publishing_available": True}
