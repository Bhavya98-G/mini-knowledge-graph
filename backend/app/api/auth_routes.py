from fastapi import APIRouter, HTTPException, Depends
from app.auth.schemas import UserCreate, UserResponse, Userlogin, ForgotPassword, ResetPassword, LoginResponse
from app.auth.services import create_user, login_user, forgot_password_user, reset_password_user
from app.core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["auth"],prefix="/auth")

@router.post("/register", response_model=UserResponse)
async def register(user: UserCreate, db: AsyncSession = Depends(get_db)):
    return await create_user(user, db)

@router.post("/login", response_model=LoginResponse)
async def login(user: Userlogin, db: AsyncSession = Depends(get_db)):
    return await login_user(user, db)

@router.post("/forgot-password")
async def forgot_password(user: ForgotPassword, db: AsyncSession = Depends(get_db)):
    return await forgot_password_user(user, db)

@router.post("/reset-password")
async def reset_password(user: ResetPassword, db: AsyncSession = Depends(get_db)):
    return await reset_password_user(user, db)
