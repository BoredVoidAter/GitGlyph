from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse, JSONResponse
from authlib.integrations.starlette_client import OAuth
from dotenv import load_dotenv
import os
import httpx
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.cors import CORSMiddleware
from datetime import datetime

load_dotenv()

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SESSION_SECRET_KEY"))

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500"],  # Allow requests from your frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth = OAuth()
oauth.register(
    name='github',
    client_id=os.getenv('GITHUB_CLIENT_ID'),
    client_secret=os.getenv('GITHUB_CLIENT_SECRET'),
    access_token_url='https://github.com/login/oauth/access_token',
    authorize_url='https://github.com/login/oauth/authorize',
    api_base_url='https://api.github.com/',
    client_kwargs={'scope': 'read:user repo'}, # Changed scope to 'repo' for private repo access
)

oauth.register(
    name='gitlab',
    client_id=os.getenv('GITLAB_CLIENT_ID'),
    client_secret=os.getenv('GITLAB_CLIENT_SECRET'),
    access_token_url='https://gitlab.com/oauth/token',
    authorize_url='https://gitlab.com/oauth/authorize',
    api_base_url='https://gitlab.com/api/v4/',
    client_kwargs={'scope': 'read_user read_repository'},
)

@app.get("/login/github")
async def login_github(request: Request):
    return await oauth.github.authorize_redirect(request, "http://localhost:8000/auth/github/callback")

@app.get("/auth/github/callback")
async def auth_github_callback(request: Request):
    try:
        token = await oauth.github.authorize_access_token(request)
        request.session["user"] = dict(token)
        request.session["provider"] = "github"
        
        # Fetch user profile information
        user_info_response = await oauth.github.get("user", token=token)
        user_info_response.raise_for_status()
        user_info = user_info_response.json()
        request.session["user_profile"] = user_info

        return RedirectResponse(url="http://localhost:5500") # Redirect to frontend
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentication failed: {e}")

@app.get("/login/gitlab")
async def login_gitlab(request: Request):
    return await oauth.gitlab.authorize_redirect(request, "http://localhost:8000/auth/gitlab/callback")

@app.get("/auth/gitlab/callback")
async def auth_gitlab_callback(request: Request):
    try:
        token = await oauth.gitlab.authorize_access_token(request)
        request.session["user"] = dict(token)
        request.session["provider"] = "gitlab"

        # Fetch user profile information
        user_info_response = await oauth.gitlab.get("user", token=token)
        user_info_response.raise_for_status()
        user_info = user_info_response.json()
        request.session["user_profile"] = user_info

        return RedirectResponse(url="http://localhost:5500") # Redirect to frontend
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentication failed: {e}")

@app.get("/api/user")
async def get_user(request: Request):
    if "user_profile" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return request.session["user_profile"]

@app.get("/api/logout")
async def logout(request: Request):
    request.session.pop("user", None)
    request.session.pop("user_profile", None)
    return {"message": "Logged out successfully"}

async def get_repositories(request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    provider = request.session.get("provider")
    access_token = request.session["user"]["access_token"]
    
    async with httpx.AsyncClient() as client:
        if provider == "github":
            headers = {"Authorization": f"token {access_token}"}
            response = await client.get("https://api.github.com/user/repos?type=all", headers=headers)
            response.raise_for_status()
            repos = response.json()
            return [{"name": repo["name"], "full_name": repo["full_name"], "private": repo["private"], "provider": "github"} for repo in repos]
        elif provider == "gitlab":
            headers = {"Authorization": f"Bearer {access_token}"}
            response = await client.get("https://gitlab.com/api/v4/projects?membership=true&simple=true", headers=headers)
            response.raise_for_status()
            repos = response.json()
            return [{"name": repo["name"], "full_name": repo["path_with_namespace"], "private": not repo["public"], "provider": "gitlab"} for repo in repos]
        else:
            raise HTTPException(status_code=400, detail="Unknown provider")

@app.get("/api/commits/{provider}/{owner}/{repo}")
async def get_commits(provider: str, owner: str, repo: str, request: Request, start_date: str = None, end_date: str = None):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    access_token = request.session["user"]["access_token"]
    
    async with httpx.AsyncClient() as client:
        all_commits = []
        if provider == "github":
            headers = {"Authorization": f"token {access_token}"}
            branches_response = await client.get(f"https://api.github.com/repos/{owner}/{repo}/branches", headers=headers)
            branches_response.raise_for_status()
            branches = branches_response.json()

            for branch in branches:
                branch_name = branch["name"]
                commits_url = f"https://api.github.com/repos/{owner}/{repo}/commits?sha={branch_name}"
                commits_response = await client.get(commits_url, headers=headers)
                commits_response.raise_for_status()
                commits = commits_response.json()
                
                for commit in commits:
                    commit_details_url = f"https://api.github.com/repos/{owner}/{repo}/commits/{commit["sha"]}"
                    commit_details_response = await client.get(commit_details_url, headers=headers)
                    commit_details_response.raise_for_status()
                    commit_details = commit_details_response.json()

                    all_commits.append({
                        "sha": commit["sha"],
                        "message": commit["commit"]["message"],
                        "author_name": commit["commit"]["author"]["name"],
                        "date": commit["commit"]["author"]["date"],
                        "branch": branch_name,
                        "files": commit_details["files"]
                    })
        elif provider == "gitlab":
            headers = {"Authorization": f"Bearer {access_token}"}
            # GitLab API uses project ID, not owner/repo name for many calls. Need to get project ID first.
            # For simplicity, assuming 'repo' here is the 'path_with_namespace' and we can use it to find the project.
            # A more robust solution would involve storing the project ID during repo listing.
            project_response = await client.get(f"https://gitlab.com/api/v4/projects/{owner}%2F{repo}", headers=headers)
            project_response.raise_for_status()
            project_id = project_response.json()["id"]

            commits_response = await client.get(f"https://gitlab.com/api/v4/projects/{project_id}/repository/commits", headers=headers)
            commits_response.raise_for_status()
            commits = commits_response.json()

            for commit in commits:
                all_commits.append({
                    "sha": commit["id"],
                    "message": commit["message"],
                    "author_name": commit["author_name"],
                    "date": commit["created_at"],
                    "branch": "master" # GitLab API for project commits doesn't directly give branch per commit easily without more calls
                })
        else:
            raise HTTPException(status_code=400, detail="Unknown provider")
        
        all_commits.sort(key=lambda x: x["date"])

        # Filter by date range if provided
        if start_date:
            start_timestamp = datetime.strptime(start_date, "%Y-%m-%d").timestamp()
            all_commits = [c for c in all_commits if datetime.strptime(c["date"].split("T")[0], "%Y-%m-%d").timestamp() >= start_timestamp]
        if end_date:
            end_timestamp = datetime.strptime(end_date, "%Y-%m-%d").timestamp()
            all_commits = [c for c in all_commits if datetime.strptime(c["date"].split("T")[0], "%Y-%m-%d").timestamp() <= end_timestamp]
        
        return all_commits

import uuid

# In-memory storage for shared glyphs (for demonstration purposes)
shared_glyphs = {}

@app.post("/api/share-glyph")
async def share_glyph(request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    data = await request.json()
    glyph_data = data.get("glyph_data")
    if not glyph_data:
        raise HTTPException(status_code=400, detail="No glyph data provided")
    
    share_id = str(uuid.uuid4())
    shared_glyphs[share_id] = glyph_data
    return {"share_url": f"http://localhost:5500/glyph/{share_id}"}

@app.get("/api/glyph/{share_id}")
async def get_shared_glyph(share_id: str):
    glyph_data = shared_glyphs.get(share_id)
    if not glyph_data:
        raise HTTPException(status_code=404, detail="Glyph not found")
    return glyph_data

@app.get("/")
async def read_root():
    return {"message": "Welcome to GitGlyph!"}

