from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth
from dotenv import load_dotenv
import os
import httpx

load_dotenv()

app = FastAPI()

oauth = OAuth()
oauth.register(
    name='github',
    client_id=os.getenv('GITHUB_CLIENT_ID'),
    client_secret=os.getenv('GITHUB_CLIENT_SECRET'),
    access_token_url='https://github.com/login/oauth/access_token',
    authorize_url='https://github.com/login/oauth/authorize',
    api_base_url='https://api.github.com/',
    client_kwargs={'scope': 'read:user public_repo'},
)

@app.get("/login/github")
async def login_github(request: Request):
    return await oauth.github.authorize_redirect(request, "http://localhost:8000/auth/github/callback")

@app.get("/auth/github/callback")
async def auth_github_callback(request: Request):
    try:
        token = await oauth.github.authorize_access_token(request)
        request.session["user"] = dict(token)
        return RedirectResponse(url="/")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Authentication failed: {e}")

@app.get("/api/repositories")
async def get_repositories(request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    access_token = request.session["user"]["access_token"]
    headers = {"Authorization": f"token {access_token}"}
    
    async with httpx.AsyncClient() as client:
        response = await client.get("https://api.github.com/user/repos?type=public", headers=headers)
        response.raise_for_status()
        repos = response.json()
        return [{"name": repo["name"], "full_name": repo["full_name"]} for repo in repos]

@app.get("/api/commits/{owner}/{repo}")
async def get_commits(owner: str, repo: str, request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    access_token = request.session["user"]["access_token"]
    headers = {"Authorization": f"token {access_token}"}
    
    async with httpx.AsyncClient() as client:
        response = await client.get(f"https://api.github.com/repos/{owner}/{repo}/commits", headers=headers)
        response.raise_for_status()
        commits = response.json()
        
        processed_commits = []
        for commit in commits:
            processed_commits.append({
                "sha": commit["sha"],
                "message": commit["commit"]["message"],
                "author_name": commit["commit"]["author"]["name"],
                "date": commit["commit"]["author"]["date"],
            })
        return processed_commits

@app.get("/")
async def read_root():
    return {"message": "Welcome to GitGlyph!"}

