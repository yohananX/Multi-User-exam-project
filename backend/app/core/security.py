from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import bcrypt

from app.config import settings

bearer_scheme = HTTPBearer()


class CurrentUser:
    def __init__(self, data: dict):
        self.id: int = data["id"]
        self.username: str = data["username"]
        self.email: str = data["email"]
        self.full_name: str = data["full_name"]
        self.role: str = data["role"]
        self.school_id: int | None = data.get("school_id")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    from app.supabase_db import select

    token = credentials.credentials

    # Try backend JWT first
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")
        if user_id is not None:
            user = select("users", filters={"id": f"eq.{int(user_id)}"}, single=True)
            if user:
                return CurrentUser(user)
    except Exception:
        pass

    # Fall back to Supabase JWT
    try:
        payload = jwt.get_unverified_claims(token)
        auth_id = payload.get("sub")
        email = payload.get("email")
        if auth_id:
            user = select("users", filters={"auth_id": f"eq.{auth_id}"}, single=True)
            if user:
                return CurrentUser(user)
        if email:
            user = select("users", filters={"email": f"eq.{email}"}, single=True)
            if user:
                return CurrentUser(user)
    except Exception:
        pass

    raise HTTPException(status_code=401, detail="Invalid token")


def require_role(*roles: str):
    def checker(current_user: CurrentUser = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return current_user
    return checker


require_super_admin = require_role("super_admin")
require_admin = require_role("super_admin", "school_admin")
