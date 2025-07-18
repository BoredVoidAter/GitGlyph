
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi import HTTPException, Request
from pydantic import BaseModel
from datetime import datetime
from typing import List, Dict, Optional
import uuid
import os
from dotenv import load_dotenv
from git import Repo, exc
import svgwrite

load_dotenv()

class GlyphSnapshot(BaseModel):
    timestamp: datetime
    commit_hash: str
    svg_content: str

class GlyphCollection(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    snapshots: List[GlyphSnapshot] = []

app = FastAPI()

# In-memory storage for glyph collections (for demonstration purposes)
glyph_collections: Dict[str, GlyphCollection] = {}

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Allow your frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# OAuth2 related imports and setup (simplified for example)
from starlette.config import Config
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth

# Load configuration from .env file
config = Config(".env")

# Session Middleware for OAuth (requires a secret key)
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SECRET_KEY", "super-secret"))

# OAuth setup
oauth = OAuth(config)

CONF_URL = "https://accounts.google.com/.well-known/openid-configuration"
oauth.register(
    name="google",
    server_metadata_url=CONF_URL,
    client_kwargs={
        "scope": "openid email profile"
    },
)

# GitHub OAuth (example, replace with actual GitHub setup)
oauth.register(
    name="github",
    client_id=os.getenv("GITHUB_CLIENT_ID"),
    client_secret=os.getenv("GITHUB_CLIENT_SECRET"),
    access_token_url="https://github.com/login/oauth/access_token",
    authorize_url="https://github.com/login/oauth/authorize",
    api_base_url="https://api.github.com/",
    client_kwargs={"scope": "read:user"},
)

@app.get("/")
async def read_root():
    return {"message": "Welcome to GitGlyph API"}

@app.get("/login/google")
async def login_google(request: Request):
    redirect_uri = request.url_for("auth_google")
    return await oauth.google.authorize_redirect(request, redirect_uri)

@app.get("/auth/google")
async def auth_google(request: Request):
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = await oauth.google.parse_id_token(request, token)
        request.session["user"] = user_info["sub"]
        request.session["user_profile"] = user_info
        request.session["provider"] = "google"
        return RedirectResponse(url="http://localhost:5173/dashboard") # Redirect to your frontend dashboard
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentication failed: {e}")

@app.get("/login/github")
async def login_github(request: Request):
    redirect_uri = request.url_for("auth_github")
    return await oauth.github.authorize_redirect(request, redirect_uri)

@app.get("/auth/github")
async def auth_github(request: Request):
    try:
        token = await oauth.github.authorize_access_token(request)
        resp = await oauth.github.get("user", token=token)
        profile = resp.json()
        request.session["user"] = profile["id"]
        request.session["user_profile"] = profile
        request.session["provider"] = "github"
        return RedirectResponse(url="http://localhost:5173/dashboard") # Redirect to your frontend dashboard
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentication failed: {e}")

@app.get("/logout")
async def logout(request: Request):
    request.session.pop("user", None)
    request.session.pop("user_profile", None)
    request.session.pop("provider", None)
    return {"message": "Logged out"}

@app.get("/user")
async def get_user(request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return request.session.get("user_profile")

@app.post("/api/collections")
async def create_glyph_collection(request: Request, collection: GlyphCollection):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")
    if collection.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to create collection for this user.")

    collection.id = str(uuid.uuid4())
    collection.created_at = datetime.now()
    glyph_collections[collection.id] = collection
    return {"message": "Glyph collection created successfully", "collection_id": collection.id}

@app.get("/api/collections")
async def list_glyph_collections(request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")
    
    user_collections = [c for c in glyph_collections.values() if c.user_id == user_id]
    return user_collections

@app.get("/api/collections/{collection_id}")
async def get_glyph_collection(collection_id: str, request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    collection = glyph_collections.get(collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Glyph collection not found")
    
    user_id = request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")
    if collection.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to access this collection.")
    
    return collection

@app.put("/api/collections/{collection_id}")
async def update_glyph_collection(collection_id: str, request: Request, updated_collection: GlyphCollection):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    existing_collection = glyph_collections.get(collection_id)
    if not existing_collection:
        raise HTTPException(status_code=404, detail="Glyph collection not found")
    
    user_id = request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")
    if existing_collection.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to update this collection.")
    
    # Update fields that are allowed to be updated
    existing_collection.name = updated_collection.name
    existing_collection.description = updated_collection.description
    existing_collection.snapshots = updated_collection.snapshots # This allows adding/removing snapshots
    
    glyph_collections[collection_id] = existing_collection # Update in storage
    
    return {"message": "Glyph collection updated successfully", "collection": existing_collection}
