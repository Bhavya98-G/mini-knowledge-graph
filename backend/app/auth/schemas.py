from pydantic import BaseModel
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime

class Userlogin(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class ForgotPassword(BaseModel):
    email: str
    admin_key: int
    new_password: str

class ResetPassword(BaseModel):
    email: str
    old_password: str
    new_password: str

