import jwt
from datetime import datetime, timedelta
import bcrypt
from app.auth.schemas import LoginResponse, UserCreate, Userlogin, ForgotPassword, ResetPassword
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException
from app.core.config import get_settings
from app.models.sql import User

settings = get_settings()

async def hash_password(password: str):
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

async def verify_password(plain_password: str, hashed_password: str):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

async def create_access_token(user_id: int):
    to_encode = {"user_id": user_id}
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

async def create_user(user: UserCreate, db: AsyncSession):
    try:
        result = await db.execute(
            select(User).where(User.email == user.email)
        )
        existing_user = result.scalar_one_or_none()
        if existing_user:
            raise HTTPException(status_code=400, detail="User already exists")
        
        hashed_password = await hash_password(user.password)
        new_user = User(username=user.username, email=user.email, password=hashed_password)
        db.add(new_user)
        await db.commit()
        return new_user
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

async def login_user(user: Userlogin, db: AsyncSession):
    try:
        result = await db.execute(
            select(User).where(User.email == user.email)
        )
        existing_user = result.scalar_one_or_none()
        if not existing_user:
            raise HTTPException(status_code=400, detail="User not found")
        
        if not await verify_password(user.password, existing_user.password):
            raise HTTPException(status_code=400, detail="Invalid password")
        
        access_token = await create_access_token(existing_user.id)
        return LoginResponse(access_token=access_token, token_type="bearer")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

async def forgot_password_user(user: ForgotPassword, db: AsyncSession):
    try:
        result = await db.execute(
            select(User).where(User.email == user.email)
        )
        existing_user = result.scalar_one_or_none()
        if not existing_user:
            raise HTTPException(status_code=400, detail="User not found")
        
        if user.admin_key != settings.ADMIN_KEY:
            raise HTTPException(status_code=400, detail="Invalid admin key")
        
        hashed_password = await hash_password(user.new_password)
        existing_user.password = hashed_password
        await db.commit()
        return {"message": "Password reset successful"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

async def reset_password_user(user: ResetPassword, db: AsyncSession):
    try:
        result = await db.execute(
            select(User).where(User.email == user.email)
        )
        existing_user = result.scalar_one_or_none()
        if not existing_user:
            raise HTTPException(status_code=400, detail="User not found")
        
        if not await verify_password(user.old_password, existing_user.password):
            raise HTTPException(status_code=400, detail="Invalid old password")
        
        hashed_password = await hash_password(user.new_password)
        existing_user.password = hashed_password
        await db.commit()
        return {"message": "Password reset successful"}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))
