from fastapi import HTTPException, Request
from app.core.config import get_settings
import jwt
from collections import deque
import time

settings = get_settings()
user_request_timestamps = {}

def _check_rate_limit(rate_limit_id):
    current_time = time.time()
    
    if rate_limit_id not in user_request_timestamps:
        user_request_timestamps[rate_limit_id] = deque()
        
    timestamps = user_request_timestamps[rate_limit_id]
    
    # Efficiently remove only the expired timestamps from the left (oldest)
    # This is O(1) per removal instead of O(N) for the whole list
    while timestamps and current_time - timestamps[0] >= settings.ACCESS_TOKEN_EXPIRE_MINUTES:
        timestamps.popleft()
        
    if len(timestamps) >= settings.MAX_REQUESTS_PER_WINDOW:
        return False
        
    timestamps.append(current_time)
    return True

async def auth_dependency(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Authorization header is missing")
    current_user_id = None
    data = None
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            data = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            current_user_id = data.get("user_id")
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
    else:
        raise HTTPException(
            status_code=401,
            detail="Authentication required: Missing X-API-Key header or valid Authorization Bearer token."
        )
    if not current_user_id:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    if not _check_rate_limit(current_user_id):
        raise HTTPException(status_code=429, detail="Too many requests")
    return current_user_id