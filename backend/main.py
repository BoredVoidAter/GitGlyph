
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException, Request
from pydantic import BaseModel
from datetime import datetime
from typing import List, Dict, Optional
import uuid
import os
from dotenv import load_dotenv
from git import Repo, exc

from starlette.config import Config
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth

from backend.notifications import send_weekly_digest
from backend.generate_mashup_glyph import generate_mashup_glyph
from backend.nlp_analysis import analyze_commit_for_goal_progress

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

class ProjectGoal(BaseModel):
    id: str
    collection_id: str
    user_id: str
    name: str
    description: Optional[str] = None
    target_date: Optional[datetime] = None
    keywords: List[str] = []
    progress: float = 0.0 # 0.0 to 1.0
    created_at: datetime
    updated_at: datetime

class GlyphCollection(BaseModel):
    id: str
    user_id: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    snapshots: List[GlyphSnapshot] = []
    is_public: bool = False # New field for public API
    user_email: Optional[str] = None # New field for notifications

app = FastAPI()

# In-memory storage for glyph collections and generated glyph data
glyph_collections: Dict[str, GlyphCollection] = {}
generated_glyphs: Dict[str, GlyphData] = {} # Stores the latest generated glyph data by collection_id
project_goals: Dict[str, ProjectGoal] = {} # Stores project goals

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
    
    existing_collection.user_email = updated_collection.user_email # Allow updating user email for notifications
    
    glyph_collections[collection_id] = existing_collection # Update in storage
    
    return {"message": "Glyph collection updated successfully", "collection": existing_collection}

@app.post("/api/collections/{collection_id}/send-digest")
async def send_digest_notification(collection_id: str, background_tasks: BackgroundTasks, request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    collection = glyph_collections.get(collection_id)
    if not collection:
        raise HTTPException(status_code=404, detail="Glyph collection not found")
    
    user_id = request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")
    if collection.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to send digest for this collection.")
    
    if not collection.user_email:
        raise HTTPException(status_code=400, detail="User email not set for this collection. Please update the collection with a user email.")

    # In a real application, repo_path would be retrieved from the collection's metadata
    # For this example, we'll use a dummy path.
    dummy_repo_path = "./dummy_repo" 
    if not os.path.exists(dummy_repo_path):
        os.makedirs(dummy_repo_path)
        # Simulate a git repo for analysis.py
        try:
            Repo.init(dummy_repo_path)
            # Create a dummy commit
            with open(os.path.join(dummy_repo_path, "test.txt"), "w") as f:
                f.write("initial commit")
            repo = Repo(dummy_repo_path)
            repo.index.add(["test.txt"])
            repo.index.commit("Initial commit for dummy repo")
        except exc.InvalidGitRepositoryError:
            pass # Already initialized or other issue
    
    background_tasks.add_task(send_weekly_digest, collection.user_email, collection.id, dummy_repo_path)
    
    return {"message": "Weekly digest email scheduled successfully."}

@app.post("/api/mashup-glyph")
async def create_mashup_glyph(request: Request, repo_structure_path: str, repo_style_path: str):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # In a real application, these paths would likely be associated with user's linked repositories
    # and validated for access.
    
    output_file = f"/tmp/mashup_glyph_{uuid.uuid4()}.svg"
    mashup_svg = generate_mashup_glyph(repo_structure_path, repo_style_path, output_file)
    
    return {"message": "Mashup Glyph generated successfully", "svg_content": mashup_svg}

@app.post("/api/goals")
async def create_project_goal(request: Request, goal: ProjectGoal):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")
    if goal.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to create goal for this user.")

    goal.id = str(uuid.uuid4())
    goal.created_at = datetime.now()
    goal.updated_at = datetime.now()
    project_goals[goal.id] = goal
    return {"message": "Project goal created successfully", "goal_id": goal.id}

@app.get("/api/goals/{goal_id}")
async def get_project_goal(goal_id: str, request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    goal = project_goals.get(goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Project goal not found")
    
    user_id = request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")
    if goal.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to access this goal.")
    
    return goal

@app.put("/api/goals/{goal_id}")
async def update_project_goal(goal_id: str, request: Request, updated_goal: ProjectGoal):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    existing_goal = project_goals.get(goal_id)
    if not existing_goal:
        raise HTTPException(status_code=404, detail="Project goal not found")
    
    user_id = request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")
    if existing_goal.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to update this goal.")
    
    existing_goal.name = updated_goal.name
    existing_goal.description = updated_goal.description
    existing_goal.target_date = updated_goal.target_date
    existing_goal.keywords = updated_goal.keywords
    existing_goal.updated_at = datetime.now()
    
    project_goals[goal_id] = existing_goal
    
    return {"message": "Project goal updated successfully", "goal": existing_goal}

@app.delete("/api/goals/{goal_id}")
async def delete_project_goal(goal_id: str, request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    goal = project_goals.get(goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Project goal not found")
    
    user_id = request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")
    if goal.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to delete this goal.")
    
    del project_goals[goal_id]
    
    return {"message": "Project goal deleted successfully"}

@app.post("/api/goals/{goal_id}/track-progress")
async def track_goal_progress(goal_id: str, request: Request, commit_messages: List[str]):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    goal = project_goals.get(goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Project goal not found")
    
    user_id = request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")
    if goal.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to track progress for this goal.")
    
    total_score = 0
    for msg in commit_messages:
        total_score += analyze_commit_for_goal_progress(msg, goal.keywords)
    
    # Simple progress calculation: total score / (number of commits * max keywords per commit)
    # This needs to be refined based on how progress is truly measured.
    # For now, let's assume a max score per commit is len(goal.keywords)
    max_possible_score = len(commit_messages) * len(goal.keywords) if len(goal.keywords) > 0 else 1
    
    goal.progress = min(1.0, total_score / max_possible_score)
    goal.updated_at = datetime.now()
    
    project_goals[goal_id] = goal
    
    return {"message": "Goal progress updated successfully", "goal": goal}
