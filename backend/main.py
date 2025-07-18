
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi import HTTPException, Request, Depends
from pydantic import BaseModel
from datetime import datetime
from typing import List, Dict, Optional
import uuid
import os
from dotenv import load_dotenv
from git import Repo, exc
import svgwrite

from backend.generate_glyph import generate_glyph
from backend.analysis import analyze_glyph_health

load_dotenv()

class GlyphHealthMetrics(BaseModel):
    feature_to_fix_ratio: float
    code_churn_volatility: float
    commit_cadence: float
    stability_graph_data: List[float]
    development_tempo_data: List[float]

class GlyphSnapshot(BaseModel):
    timestamp: datetime
    commit_hash: str
    svg_content: str
    health_metrics: Optional[GlyphHealthMetrics] = None

class GlyphData(BaseModel):
    svg_content: str
    health_metrics: GlyphHealthMetrics
    # Add other relevant data points like coordinates, colors, animation timings
    # For now, we'll keep it simple with just SVG and health metrics

class GlyphCollection(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    snapshots: List[GlyphSnapshot] = []
    is_public: bool = False # New field for public API

app = FastAPI()

# In-memory storage for glyph collections and generated glyph data
glyph_collections: Dict[str, GlyphCollection] = {}
generated_glyphs: Dict[str, GlyphData] = {} # Stores the latest generated glyph data by collection_id

# Simple API Key storage (for demonstration)
API_KEYS = {"test_api_key": "user123"} # In a real app, this would be a database

def get_api_key(request: Request):
    api_key = request.headers.get("X-API-Key")
    if not api_key or api_key not in API_KEYS:
        raise HTTPException(status_code=403, detail="Could not validate API Key")
    return api_key

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Allow your frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

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
