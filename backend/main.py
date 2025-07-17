from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse, JSONResponse
from authlib.integrations.starlette_client import OAuth
from dotenv import load_dotenv
import os
import httpx
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.cors import CORSMiddleware

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

@app.get("/login/github")
async def login_github(request: Request):
    return await oauth.github.authorize_redirect(request, "http://localhost:8000/auth/github/callback")

@app.get("/auth/github/callback")
async def auth_github_callback(request: Request):
    try:
        token = await oauth.github.authorize_access_token(request)
        request.session["user"] = dict(token)
        
        # Fetch user profile information
        user_info_response = await oauth.github.get("user", token=token)
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

@app.get("/api/repositories")
async def get_repositories(request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    access_token = request.session["user"]["access_token"]
    headers = {"Authorization": f"token {access_token}"}
    
    async with httpx.AsyncClient() as client:
        # Fetch both public and private repositories
        response = await client.get("https://api.github.com/user/repos?type=all", headers=headers)
        response.raise_for_status()
        repos = response.json()
        return [{"name": repo["name"], "full_name": repo["full_name"], "private": repo["private"]} for repo in repos]

@app.get("/api/commits/{owner}/{repo}")
async def get_commits(owner: str, repo: str, request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    access_token = request.session["user"]["access_token"]
    headers = {"Authorization": f"token {access_token}"}
    
    async with httpx.AsyncClient() as client:
        # Fetch all branches
        branches_response = await client.get(f"https://api.github.com/repos/{owner}/{repo}/branches", headers=headers)
        branches_response.raise_for_status()
        branches = branches_response.json()

        all_commits = []
        for branch in branches:
            branch_name = branch["name"]
            commits_url = f"https://api.github.com/repos/{owner}/{repo}/commits?sha={branch_name}"
            commits_response = await client.get(commits_url, headers=headers)
            commits_response.raise_for_status()
            commits = commits_response.json()
            
            for commit in commits:
                all_commits.append({
                    "sha": commit["sha"],
                    "message": commit["commit"]["message"],
                    "author_name": commit["commit"]["author"]["name"],
                    "date": commit["commit"]["author"]["date"],
                    "branch": branch_name # Add branch information
                })
        
        # Sort commits by date
        all_commits.sort(key=lambda x: x["date"])
        
        return all_commits

@app.get("/")
async def read_root():
    return {"message": "Welcome to GitGlyph!"}

