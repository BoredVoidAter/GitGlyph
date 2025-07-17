from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse, JSONResponse
from authlib.integrations.starlette_client import OAuth
from dotenv import load_dotenv
import os
import httpx
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.cors import CORSMiddleware
from datetime import datetime
from pydantic import BaseModel
from typing import List, Dict
import uuid
from collections import Counter

# Pydantic models for new features
class GlyphStatistics(BaseModel):
    total_commits: int
    busiest_day: str
    top_contributors: Dict[str, int]
    commit_cadence: Dict[str, int]
    commit_intent_breakdown: Dict[str, float]

class GlyphSnapshot(BaseModel):
    id: str
    user_id: str
    repository_full_name: str
    provider: str
    name: str
    description: str = None
    created_at: datetime
    config: Dict # e.g., time_range, theme, branch_comparison
    last_commit_sha: str # To enable refresh

# NLP for commit intent analysis
import nltk
from nltk.sentiment import SentimentIntensityAnalyzer

# Download NLTK data (only needs to be run once)
try:
    nltk.data.find('corpora/stopwords')
except nltk.downloader.DownloadError:
    nltk.download('stopwords')
try:
    nltk.data.find('tokenizers/punkt')
except nltk.downloader.DownloadError:
    nltk.download('punkt')
try:
    nltk.data.find('sentiment/vader_lexicon')
except nltk.downloader.DownloadError:
    nltk.download('vader_lexicon')

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

def calculate_glyph_statistics(commits: List[Dict]) -> GlyphStatistics:
    total_commits = len(commits)
    if total_commits == 0:
        return GlyphStatistics(
            total_commits=0,
            busiest_day="N/A",
            top_contributors={},
            commit_cadence={},
            commit_intent_breakdown={}
        )

    # Busiest Development Day
    commit_dates = [datetime.fromisoformat(c["date"].replace("Z", "+00:00")).date() for c in commits]
    busiest_day_counter = Counter(commit_dates)
    busiest_day = busiest_day_counter.most_common(1)[0][0].isoformat() if busiest_day_counter else "N/A"

    # Top Contributors by Commit Volume
    author_counter = Counter(c["author_name"] for c in commits)
    top_contributors = dict(author_counter.most_common(5)) # Top 5 contributors

    # Project Rhythm (Commit Cadence - e.g., commits per day of week, or hour of day)
    # For simplicity, let's do commits per day of week
    day_of_week_counter = Counter(datetime.fromisoformat(c["date"].replace("Z", "+00:00")).strftime("%A") for c in commits)
    commit_cadence = dict(day_of_week_counter)

    # Percentage breakdown of commit intents
    intent_counter = Counter(c["intent"] for c in commits)
    commit_intent_breakdown = {
        intent: (count / total_commits) * 100 for intent, count in intent_counter.items()
    }

    return GlyphStatistics(
        total_commits=total_commits,
        busiest_day=busiest_day,
        top_contributors=top_contributors,
        commit_cadence=commit_cadence,
        commit_intent_breakdown=commit_intent_breakdown
    )

# NLP Function for Commit Intent Analysis
def analyze_commit_intent(message: str) -> Dict[str, str]:
    message_lower = message.lower()
    intent = "other"
    sentiment = "neutral"

    # Intent analysis based on conventional commit standards and keywords
    if message_lower.startswith("feat"):
        intent = "feature"
    elif message_lower.startswith("fix"):
        intent = "bug_fix"
    elif message_lower.startswith("refactor"):
        intent = "refactor"
    elif message_lower.startswith("docs"):
        intent = "documentation"
    elif message_lower.startswith("style"):
        intent = "style"
    elif message_lower.startswith("test"):
        intent = "test"
    elif message_lower.startswith("chore"):
        intent = "chore"
    elif message_lower.startswith("build"):
        intent = "build"
    elif message_lower.startswith("ci"):
        intent = "ci"
    elif message_lower.startswith("perf"):
        intent = "performance"
    elif message_lower.startswith("revert"):
        intent = "revert"
    elif "add" in message_lower:
        intent = "feature"
    elif "implement" in message_lower:
        intent = "feature"
    elif "bug" in message_lower or "issue" in message_lower:
        intent = "bug_fix"
    elif "correct" in message_lower:
        intent = "bug_fix"
    elif "update" in message_lower:
        intent = "chore"
    elif "remove" in message_lower or "delete" in message_lower:
        intent = "chore"
    elif "config" in message_lower:
        intent = "configuration"
    elif "merge" in message_lower:
        intent = "merge"
    
    # Sentiment analysis
    sid = SentimentIntensityAnalyzer()
    sentiment_scores = sid.polarity_scores(message)
    if sentiment_scores['compound'] >= 0.05:
        sentiment = "positive"
    elif sentiment_scores['compound'] <= -0.05:
        sentiment = "negative"
    else:
        sentiment = "neutral"

    return {"intent": intent, "sentiment": sentiment}


@app.get("/api/commits/{provider}/{owner}/{repo}")
async def get_commits(provider: str, owner: str, repo: str, request: Request, start_date: str = None, end_date: str = None, since_sha: str = None):
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
                if since_sha:
                    commits_url += f"&since={since_sha}" # GitHub API uses 'since' for date, but 'sha' for starting commit
                if since_sha:
                    commits_url += f"&since={since_sha}" # GitHub API uses 'since' for date, but 'sha' for starting commit
                commits_response = await client.get(commits_url, headers=headers)
                commits_response.raise_for_status()
                commits = commits_response.json()
                
                for commit in commits:
                    commit_details_url = f"https://api.github.com/repos/{owner}/{repo}/commits/{commit["sha"]}"
                    commit_details_response = await client.get(commit_details_url, headers=headers)
                    commit_details_response.raise_for_status()
                    commit_details = commit_details_response.json()

                    total_additions = sum(f["additions"] for f in commit_details["files"])
                    total_deletions = sum(f["deletions"] for f in commit_details["files"])

                    intent_data = analyze_commit_intent(commit["commit"]["message"])

                    all_commits.append({
                        "sha": commit["sha"],
                        "message": commit["commit"]["message"],
                        "author_name": commit["commit"]["author"]["name"],
                        "date": commit["commit"]["author"]["date"],
                        "branch": branch_name,
                        "files": commit_details["files"],
                        "total_additions": total_additions,
                        "total_deletions": total_deletions,
                        "intent": intent_data["intent"],
                        "sentiment": intent_data["sentiment"]
                    })
        elif provider == "gitlab":
            headers = {"Authorization": f"Bearer {access_token}"}
            # GitLab API uses project ID, not owner/repo name for many calls. Need to get project ID first.
            # For simplicity, assuming 'repo' here is the 'path_with_namespace' and we can use it to find the project.
            # A more robust solution would involve storing the project ID during repo listing.
            project_response = await client.get(f"https://gitlab.com/api/v4/projects/{owner}%2F{repo}", headers=headers)
            project_response.raise_for_status()
            project_id = project_response.json()["id"]

            commits_url = f"https://gitlab.com/api/v4/projects/{project_id}/repository/commits"
            if since_sha:
                # GitLab API uses 'since' for date, but 'sha' for starting commit
                # GitLab's API for commits doesn't directly support a 'since_sha' parameter
                # for incremental fetches in the same way GitHub does. 
                # A common workaround is to filter by date or fetch all and filter client-side.
                # For simplicity, we'll add a note here and assume client-side filtering for now
                # if a since_sha is provided for GitLab.
                # In a real-world scenario, you might fetch commits until you hit the since_sha.
                print(f"Warning: 'since_sha' parameter is not directly supported by GitLab API for incremental fetches. Fetching all commits and filtering client-side if needed.")
            commits_response = await client.get(commits_url, headers=headers)
            commits_response.raise_for_status()
            commits = commits_response.json()

            for commit in commits:
                intent_data = analyze_commit_intent(commit["message"])
                all_commits.append({
                    "sha": commit["id"],
                    "message": commit["message"],
                    "author_name": commit["author_name"],
                    "date": commit["created_at"],
                    "branch": "master", # GitLab API for project commits doesn't directly give branch per commit easily without more calls
                    "intent": intent_data["intent"],
                    "sentiment": intent_data["sentiment"]
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
        
        # Get the SHA of the latest commit if available
        last_commit_sha = all_commits[-1]["sha"] if all_commits else None
        
        return {"commits": all_commits, "last_commit_sha": last_commit_sha}

@app.get("/api/glyph-statistics/{provider}/{owner}/{repo}")
async def get_glyph_statistics(provider: str, owner: str, repo: str, request: Request, start_date: str = None, end_date: str = None):
    # Reuse the get_commits logic to fetch the commits
    commits = await get_commits(provider, owner, repo, request, start_date, end_date)
    
    # Calculate statistics from the fetched commits
    stats = calculate_glyph_statistics(commits)
    return stats

class RepoDetails(BaseModel):
    provider: str
    owner: str
    repo: str

class StoryAnnotation(BaseModel):
    commit_sha: str
    title: str
    description: str
    date: str

# In-memory storage for story annotations
story_annotations: Dict[str, List[StoryAnnotation]] = {} # glyph_id -> list of annotations
glyph_snapshots: Dict[str, GlyphSnapshot] = {} # snapshot_id -> GlyphSnapshot object

@app.post("/api/team-commits")
async def get_team_commits(request: Request, repos: List[RepoDetails], start_date: str = None, end_date: str = None):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    all_team_commits = []
    for repo_detail in repos:
        try:
            # Reuse the existing get_commits logic
            repo_commits = await get_commits(
                provider=repo_detail.provider,
                owner=repo_detail.owner,
                repo=repo_detail.repo,
                request=request,
                start_date=start_date,
                end_date=end_date,
                since_sha=since_sha # Pass since_sha to get_commits
            )
            # Add repository information to each commit for distinct visual cues
            for commit in repo_commits:
                commit["repository"] = f"{repo_detail.owner}/{repo_detail.repo}"
                commit["provider"] = repo_detail.provider
            all_team_commits.extend(repo_commits)
        except HTTPException as e:
            # Log or handle errors for individual repositories, but don't stop the whole process
            print(f"Error fetching commits for {repo_detail.owner}/{repo_detail.repo}: {e.detail}")
            continue
    
    all_team_commits.sort(key=lambda x: x["date"])
    return all_team_commits

# In-memory storage for shared glyphs and gallery (for demonstration purposes)
shared_glyphs = {}
glyph_gallery = [] # Stores metadata about shared glyphs for the gallery

@app.post("/api/snapshots")
async def create_glyph_snapshot(request: Request, snapshot: GlyphSnapshot):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")
    if snapshot.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to create snapshot for this user.")

    snapshot.id = str(uuid.uuid4())
    snapshot.created_at = datetime.now()
    glyph_snapshots[snapshot.id] = snapshot
    return {"message": "Glyph snapshot created successfully", "snapshot_id": snapshot.id}

@app.get("/api/snapshots/{snapshot_id}")
async def get_glyph_snapshot(snapshot_id: str, request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    snapshot = glyph_snapshots.get(snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Glyph snapshot not found")
    
    user_id = request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")
    if snapshot.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to access this snapshot.")
    
    return snapshot

@app.get("/api/snapshots")
async def list_glyph_snapshots(request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")
    
    user_snapshots = [s for s in glyph_snapshots.values() if s.user_id == user_id]
    return user_snapshots

@app.get("/api/snapshots/{snapshot_id}/refresh")
async def refresh_glyph_from_snapshot(snapshot_id: str, request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    snapshot = glyph_snapshots.get(snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail="Glyph snapshot not found")
    
    user_id = request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")
    if snapshot.user_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized to refresh this snapshot.")
    
    # Fetch new commits since the last_commit_sha of the snapshot
    new_commits_data = await get_commits(
        provider=snapshot.provider,
        owner=snapshot.repository_full_name.split('/')[0], # Assuming owner/repo format
        repo=snapshot.repository_full_name.split('/')[1],
        request=request,
        since_sha=snapshot.last_commit_sha
    )
    
    # Update the snapshot's last_commit_sha with the latest commit from the refresh
    if new_commits_data["commits"]:
        snapshot.last_commit_sha = new_commits_data["last_commit_sha"]
        # In a real application, you might want to update the snapshot's config or other metadata
        # based on the new commits, or even create a new snapshot version.
        # For this task, we'll just return the new commits.
    
    return {"new_commits": new_commits_data["commits"], "updated_last_commit_sha": snapshot.last_commit_sha}

@app.post("/api/annotations/{glyph_id}")
async def add_story_annotation(glyph_id: str, annotation: StoryAnnotation):
    if glyph_id not in story_annotations:
        story_annotations[glyph_id] = []
    story_annotations[glyph_id].append(annotation)
    return {"message": "Annotation added successfully", "annotation": annotation}

@app.get("/api/annotations/{glyph_id}")
async def get_story_annotations(glyph_id: str):
    return story_annotations.get(glyph_id, [])

@app.post("/api/share-glyph")
async def share_glyph(request: Request):
    if "user" not in request.session:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    data = await request.json()
    glyph_data = data.get("glyph_data")
    metadata = data.get("metadata", {}) # Optional metadata for gallery
    annotations = data.get("annotations", []) # New: Get annotations from frontend
    
    if not glyph_data:
        raise HTTPException(status_code=400, detail="No glyph data provided")
    
    share_id = str(uuid.uuid4())
    shared_glyphs[share_id] = glyph_data

    # Store annotations with the shared glyph
    story_annotations[share_id] = annotations

    # Add to gallery with some basic metadata
    gallery_entry = {
        "id": share_id,
        "user_id": request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username"),
        "created_at": datetime.now().isoformat(),
        "complexity_score": metadata.get("complexity_score", 0), # Example metadata
        "commit_count": metadata.get("commit_count", 0),
        "title": metadata.get("title", f"Glyph by {request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")}"),
        "description": metadata.get("description", "A unique visualization of commit history."),
        "tags": metadata.get("tags", []),
        "public": metadata.get("public", True) # Assume public by default for gallery
    }
    if gallery_entry["public"]:
        glyph_gallery.append(gallery_entry)

    # Award achievements after glyph is shared
    user_id = request.session["user_profile"].get("login") if request.session.get("provider") == "github" else request.session["user_profile"].get("username")
    if user_id:
        # For achievement calculation, we need the actual commits data that generated the glyph.
        # This is a placeholder. In a real system, glyph_data would contain enough info
        # or a reference to fetch the original commits.
        # For now, we'll assume glyph_data contains a 'commits' key with the list of commits.
        # If not, this part needs to be adjusted based on how glyph_data is structured.
        if "commits" in glyph_data:
            award_achievements(user_id, glyph_data, glyph_data["commits"])
        else:
            print(f"Warning: No 'commits' data found in glyph_data for user {user_id}. Cannot award achievements.")

    return {"share_url": f"http://localhost:5500/glyph/{share_id}", "embed_snippet": f'<iframe src="http://localhost:8000/embed/glyph/{share_id}" width="600" height="400" frameborder="0"></iframe>'}

@app.get("/api/glyph/{share_id}")
async def get_shared_glyph(share_id: str):
    glyph_data = shared_glyphs.get(share_id)
    if not glyph_data:
        raise HTTPException(status_code=404, detail="Glyph not found")
    
    # Return glyph data and associated annotations
    return {"glyph_data": glyph_data, "annotations": story_annotations.get(share_id, [])}

@app.get("/embed/glyph/{share_id}")
async def embed_glyph(share_id: str):
    glyph_data = shared_glyphs.get(share_id)
    if not glyph_data:
        raise HTTPException(status_code=404, detail="Glyph not found")
    
    # This endpoint would serve a minimal HTML page that loads the glyph visualization
    # For now, we'll just return the data, and the frontend will handle rendering in an iframe
    # In a real scenario, this would be a dedicated HTML page with minimal JS to render the glyph
    return JSONResponse(content={"glyph_data": glyph_data, "annotations": story_annotations.get(share_id, [])}) # Or an HTMLResponse with embedded JS to render

@app.get("/api/gallery")
async def get_gallery(sort_by: str = "recent", filter_by_tag: str = None):
    filtered_glyphs = [g for g in glyph_gallery if g["public"]]
    
    if filter_by_tag:
        filtered_glyphs = [g for g in filtered_glyphs if filter_by_tag.lower() in [tag.lower() for tag in g.get("tags", [])]]

    if sort_by == "recent":
        filtered_glyphs.sort(key=lambda x: x["created_at"], reverse=True)
    elif sort_by == "trending":
        # Placeholder for trending logic (e.g., based on views, shares, likes)
        # For now, just sort by complexity as a proxy
        filtered_glyphs.sort(key=lambda x: x.get("complexity_score", 0), reverse=True)
    elif sort_by == "complex":
        filtered_glyphs.sort(key=lambda x: x.get("complexity_score", 0), reverse=True)
    
    return filtered_glyphs

# Achievement System (in-memory for demonstration)
user_achievements = {} # user_id -> list of achievement_ids

achievements_definitions = {
    "decade_of_code": {
        "title": "Decade of Code",
        "description": "Awarded for projects with commit history spanning 10 years or more.",
        "criteria": {"min_years": 10}
    },
    "team_titan": {
        "title": "Team Titan",
        "description": "Awarded for contributing to a large collaborative Glyph (e.g., >5 unique authors).",
        "criteria": {"min_authors": 5}
    },
    "solo_voyager": {
        "title": "Solo Voyager",
        "description": "Awarded for a significant single-author project (e.g., >1000 commits by one author).",
        "criteria": {"min_commits": 1000, "max_authors": 1}
    },
    "bug_hunter": {
        "title": "Bug Hunter",
        "description": "Awarded for a Glyph with a high proportion of 'bug_fix' commits.",
        "criteria": {"min_bug_fix_ratio": 0.3} # 30% bug fix commits
    },
    "feature_fanatic": {
        "title": "Feature Fanatic",
        "description": "Awarded for a Glyph with a high proportion of 'feature' commits.",
        "criteria": {"min_feature_ratio": 0.5} # 50% feature commits
    }
}

def award_achievements(user_id: str, glyph_data: Dict, commits: List[Dict]):
    if user_id not in user_achievements:
        user_achievements[user_id] = []

    # Calculate metrics for achievements
    commit_dates = [datetime.fromisoformat(c["date"].replace("Z", "+00:00")) for c in commits]
    min_date = min(commit_dates) if commit_dates else datetime.now()
    max_date = max(commit_dates) if commit_dates else datetime.now()
    years_diff = (max_date - min_date).days / 365.25

    unique_authors = set(c["author_name"] for c in commits)
    
    commit_intents = [c["intent"] for c in commits]
    total_commits = len(commit_intents)
    bug_fix_count = commit_intents.count("bug_fix")
    feature_count = commit_intents.count("feature")

    bug_fix_ratio = bug_fix_count / total_commits if total_commits > 0 else 0
    feature_ratio = feature_count / total_commits if total_commits > 0 else 0

    # Check criteria for each achievement
    if years_diff >= achievements_definitions["decade_of_code"]["criteria"]["min_years"] and "decade_of_code" not in user_achievements[user_id]:
        user_achievements[user_id].append("decade_of_code")
    
    if len(unique_authors) >= achievements_definitions["team_titan"]["criteria"]["min_authors"] and "team_titan" not in user_achievements[user_id]:
        user_achievements[user_id].append("team_titan")

    if len(unique_authors) <= achievements_definitions["solo_voyager"]["criteria"]["max_authors"] and \
       total_commits >= achievements_definitions["solo_voyager"]["criteria"]["min_commits"] and \
       "solo_voyager" not in user_achievements[user_id]:
        user_achievements[user_id].append("solo_voyager")

    if bug_fix_ratio >= achievements_definitions["bug_hunter"]["criteria"]["min_bug_fix_ratio"] and "bug_hunter" not in user_achievements[user_id]:
        user_achievements[user_id].append("bug_hunter")

    if feature_ratio >= achievements_definitions["feature_fanatic"]["criteria"]["min_feature_ratio"] and "feature_fanatic" not in user_achievements[user_id]:
        user_achievements[user_id].append("feature_fanatic")

@app.get("/api/achievements/{user_id}")
async def get_user_achievements(user_id: str):
    achievements = user_achievements.get(user_id, [])
    return [{"id": aid, "title": achievements_definitions[aid]["title"], "description": achievements_definitions[aid]["description"]}
            for aid in achievements]

@app.get("/")
async def read_root():
    return {"message": "Welcome to GitGlyph!"}