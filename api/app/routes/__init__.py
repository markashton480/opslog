from app.routes.events import router as events_router
from app.routes.issues import router as issues_router
from app.routes.servers import router as servers_router
from app.routes.utility import router as utility_router

__all__ = ["events_router", "issues_router", "servers_router", "utility_router"]
