"""The existing single configured owner; no token persistence or multi-user identity."""

import secrets

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


def owner_requirement(settings):
    bearer = Depends(HTTPBearer(auto_error=False))

    def require_owner(credentials: HTTPAuthorizationCredentials | None = bearer):
        token = settings.monthly_execution_token
        if not token or not token.get_secret_value():
            raise HTTPException(503, "Controlled execution is disabled", headers={"Cache-Control": "no-store"})
        if not credentials or not secrets.compare_digest(
            credentials.credentials.encode("utf-8"), token.get_secret_value().encode("utf-8")
        ):
            raise HTTPException(401, "Owner authorization is required", headers={"WWW-Authenticate": "Bearer", "Cache-Control": "no-store"})

    return require_owner
