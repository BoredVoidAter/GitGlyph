document.addEventListener('DOMContentLoaded', () => {
    const githubLoginBtn = document.getElementById('github-login');
    const gitlabLoginBtn = document.getElementById('gitlab-login');
    const repositorySelectionDiv = document.getElementById('repository-selection');
    const repoSelect = document.getElementById('repo-select');
    const orgSelect = document.getElementById('org-select');
    const generateGlyphBtn = document.getElementById('generate-glyph');
    const glyphSvg = document.getElementById('glyph-svg');
    const toggle3dViewBtn = document.getElementById('toggle-3d-view');
    const glyph2dView = document.getElementById('glyph-2d-view');
    const glyph3dView = document.getElementById('glyph-3d-view');
    const themeSelect = document.getElementById('theme-select');
    const shareGlyphBtn = document.getElementById('share-glyph');
    const shareLinkDiv = document.getElementById('share-link-div');
    const shareLink = document.getElementById('share-link');
    const embedSnippet = document.getElementById('embed-snippet');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

    // Glyph Statistics elements
    const statsPanel = document.getElementById('stats-panel');
    const toggleStatsBtn = document.getElementById('toggle-stats-btn');
    const totalCommitsSpan = document.getElementById('total-commits');
    const busiestDaySpan = document.getElementById('busiest-day');
    const topContributorsList = document.getElementById('top-contributors');
    const commitCadenceList = document.getElementById('commit-cadence');
    const commitIntentBreakdownList = document.getElementById('commit-intent-breakdown');

    // Glyph Snapshot elements
    const saveSnapshotBtn = document.getElementById('save-snapshot-btn');
    const snapshotNameInput = document.getElementById('snapshot-name');
    const snapshotDescriptionInput = document.getElementById('snapshot-description');
    const snapshotsList = document.getElementById('snapshots-list');
    const refreshGlyphBtn = document.getElementById('refresh-glyph-btn');

    let currentGlyphData = null; // To store the current glyph's data for snapshots and refresh
    let is3DView = false;

    toggle3dViewBtn.addEventListener('click', () => {
        is3DView = !is3DView;
        if (is3DView) {
            glyph2dView.style.display = 'none';
            glyph3dView.style.display = 'block';
            if (currentGlyphData) {
                render3DGlyph(currentGlyphData.commits, currentGlyphData.theme);
            }
        } else {
            glyph2dView.style.display = 'block';
            glyph3dView.style.display = 'none';
            // Re-render 2D glyph if needed, or ensure it's already there
            if (currentGlyphData) {
                generateAndVisualizeGlyph(currentGlyphData.commits, currentGlyphData.theme, currentGlyphData.annotations, currentGlyphData.last_commit_sha);
            }
        }
    });

    // Story Annotation elements
    const annotationCommitShaInput = document.getElementById('annotation-commit-sha');
    const annotationTitleInput = document.getElementById('annotation-title');
    const annotationDescriptionInput = document.getElementById('annotation-description');
    const annotationDateInput = document.getElementById('annotation-date');
    const addAnnotationBtn = document.getElementById('add-annotation-btn');
    const annotationsList = document.getElementById('annotations-list');

    let storyAnnotations = [];

    addAnnotationBtn.addEventListener('click', () => {
        const commitSha = annotationCommitShaInput.value.trim();
        const title = annotationTitleInput.value.trim();
        const description = annotationDescriptionInput.value.trim();
        const date = annotationDateInput.value;

        if (!commitSha || !title) {
            alert('Commit SHA and Title are required for an annotation.');
            return;
        }

        const newAnnotation = {
            commit_sha: commitSha,
            title: title,
            description: description,
            date: date || new Date().toISOString().split('T')[0] // Use current date if not provided
        };
        storyAnnotations.push(newAnnotation);
        renderAnnotationsList();
        // Clear form
        annotationCommitShaInput.value = '';
        annotationTitleInput.value = '';
        annotationDescriptionInput.value = '';
        annotationDateInput.value = '';
    });

    function renderAnnotationsList() {
        annotationsList.innerHTML = '';
        if (storyAnnotations.length === 0) {
            annotationsList.innerHTML = '<p>No annotations added yet.</p>';
            return;
        }
        storyAnnotations.forEach((annotation, index) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <strong>${annotation.title}</strong> (Commit: ${annotation.commit_sha})<br>
                ${annotation.description} (${annotation.date})
            `;
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remove';
            removeBtn.classList.add('small-button');
            removeBtn.addEventListener('click', () => {
                storyAnnotations.splice(index, 1);
                renderAnnotationsList();
            });
            listItem.appendChild(removeBtn);
            annotationsList.appendChild(listItem);
        });
    }

    toggleStatsBtn.addEventListener('click', () => {
        statsPanel.classList.toggle('collapsed');
    });

    function updateGlyphStatistics(stats) {
        totalCommitsSpan.textContent = stats.total_commits;
        busiestDaySpan.textContent = stats.busiest_day;

        topContributorsList.innerHTML = '';
        for (const [contributor, count] of Object.entries(stats.top_contributors)) {
            const li = document.createElement('li');
            li.textContent = `${contributor}: ${count}`;
            topContributorsList.appendChild(li);
        }

        commitCadenceList.innerHTML = '';
        for (const [cadence, count] of Object.entries(stats.commit_cadence)) {
            const li = document.createElement('li');
            li.textContent = `${cadence}: ${count}`;
            commitCadenceList.appendChild(li);
        }

        commitIntentBreakdownList.innerHTML = '';
        for (const [intent, percentage] of Object.entries(stats.commit_intent_breakdown)) {
            const li = document.createElement('li');
            li.textContent = `${intent}: ${percentage.toFixed(2)}%`;
            commitIntentBreakdownList.appendChild(li);
        }
        statsPanel.style.display = 'block'; // Ensure panel is visible when stats are updated
    }

    // Tab elements
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const galleryTab = document.getElementById('gallery-tab');
    const achievementsTab = document.getElementById('achievements-tab');
    const gallerySort = document.getElementById('gallery-sort');
    const galleryFilterTag = document.getElementById('gallery-filter-tag');
    const applyGalleryFiltersBtn = document.getElementById('apply-gallery-filters');
    const galleryList = document.getElementById('gallery-list');
    const achievementsList = document.getElementById('achievements-list');

    // Team Glyph elements
    const addRepoToTeamBtn = document.getElementById('add-repo-to-team');
    const teamRepoSelectionDiv = document.getElementById('team-repo-selection');
    const selectedTeamReposList = document.getElementById('selected-team-repos');
    const generateTeamGlyphBtn = document.getElementById('generate-team-glyph');

    let selectedTeamRepos = [];

    // Tab switching logic
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(`${button.dataset.tab}-tab`).classList.add('active');

            if (button.dataset.tab === 'gallery') {
                fetchGallery();
            } else if (button.dataset.tab === 'achievements') {
                fetchAchievements();
            }
        });
    });

    githubLoginBtn.addEventListener('click', () => {
        window.location.href = 'http://localhost:8000/login/github';
    });

    gitlabLoginBtn.addEventListener('click', () => {
        window.location.href = 'http://localhost:8000/login/gitlab';
    });

    // Check if authenticated and fetch repositories
    async function checkAuthAndFetchRepos() {
        try {
            const response = await fetch('http://localhost:8000/api/repositories');
            if (response.ok) {
                const repos = await response.json();
                githubLoginBtn.style.display = 'none';
                gitlabLoginBtn.style.display = 'none';
                repositorySelectionDiv.style.display = 'block';
                repos.forEach(repo => {
                    const option = document.createElement('option');
                    option.value = `${repo.provider}/${repo.full_name}`;
                    option.textContent = `[${repo.provider.toUpperCase()}] ${repo.full_name}`;
                    repoSelect.appendChild(option);
                });
            } else {
                console.log('Not authenticated or error fetching repos:', response.status);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    checkAuthAndFetchRepos();

    addRepoToTeamBtn.addEventListener('click', () => {
        const selectedRepo = repoSelect.value;
        if (selectedRepo && !selectedTeamRepos.includes(selectedRepo)) {
            selectedTeamRepos.push(selectedRepo);
            renderSelectedTeamRepos();
            teamRepoSelectionDiv.style.display = 'block';
        }
    });

    function renderSelectedTeamRepos() {
        selectedTeamReposList.innerHTML = '';
        selectedTeamRepos.forEach(repo => {
            const listItem = document.createElement('li');
            listItem.textContent = repo;
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remove';
            removeBtn.classList.add('small-button');
            removeBtn.addEventListener('click', () => {
                selectedTeamRepos = selectedTeamRepos.filter(r => r !== repo);
                renderSelectedTeamRepos();
                if (selectedTeamRepos.length === 0) {
                    teamRepoSelectionDiv.style.display = 'none';
                }
            });
            listItem.appendChild(removeBtn);
            selectedTeamReposList.appendChild(listItem);
        });
    }

    generateTeamGlyphBtn.addEventListener('click', async () => {
        if (selectedTeamRepos.length === 0) {
            alert('Please select at least one repository for the team glyph.');
            return;
        }

        const reposData = selectedTeamRepos.map(repo => {
            const [provider, owner, repoName] = repo.split('/');
            return { provider, owner, repo: repoName };
        });

        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const queryParams = new URLSearchParams();
        if (startDate) queryParams.append('start_date', startDate);
        if (endDate) queryParams.append('end_date', endDate);

        try {
            const response = await fetch(`http://localhost:8000/api/team-commits?${queryParams.toString()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reposData),
            });

            if (response.ok) {
                const commits = await response.json();
                console.log('Fetched team commits:', commits);
                generateAndVisualizeGlyph(commits, themeSelect.value);
            } else {
                console.error('Error fetching team commits:', response.status);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

    generateGlyphBtn.addEventListener('click', async () => {
        const selectedRepo = repoSelect.value;
        const selectedTheme = themeSelect.value; // Get selected theme
        if (selectedRepo) {
            const [provider, owner, repo] = selectedRepo.split('/');
            const startDate = startDateInput.value;
            const endDate = endDateInput.value;
            let url = `http://localhost:8000/api/commits/${provider}/${owner}/${repo}`;
            if (startDate) {
                url += `?start_date=${startDate}`;
            }
            if (endDate) {
                url += `${startDate ? '&' : '?'}end_date=${endDate}`;
            }
            try {
                const response = await fetch(url);
                if (response.ok) {
                    const commitsData = await response.json();
                    console.log('Fetched commits:', commitsData.commits);
                    localStorage.setItem('currentCommits', JSON.stringify(commitsData.commits)); // Store commits
                    generateAndVisualizeGlyph(commitsData.commits, selectedTheme, storyAnnotations, commitsData.last_commit_sha);
                } else {
                    console.error('Error fetching commits:', response.status);
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
    });

    function applyTheme(theme) {
        const container = document.querySelector('.container');
        container.classList.remove('theme-default', 'theme-ocean', 'theme-forest', 'theme-sunset');
        container.classList.add(`theme-${theme}`);
    }

    function generateAndVisualizeGlyph(commits, theme, annotations = [], lastCommitSha = null) {
        // Clear previous glyph
        glyphSvg.innerHTML = '';

        if (commits.length === 0) {
            const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
            text.setAttribute("x", "50%");
            text.setAttribute("y", "50%");
            text.setAttribute("dominant-baseline", "middle");
            text.setAttribute("text-anchor", "middle");
            text.setAttribute("fill", "#888");
            text.textContent = "No commits to display.";
            glyphSvg.appendChild(text);
            shareGlyphBtn.style.display = 'none';
            shareLinkDiv.style.display = 'none';
            statsPanel.style.display = 'none'; // Hide stats panel if no commits
            return;
        }

        applyTheme(theme);

        const svgWidth = parseInt(glyphSvg.getAttribute('width'));
        const svgHeight = parseInt(glyphSvg.getAttribute('height'));
        const centerX = svgWidth / 2;
        const centerY = svgHeight / 2;
        const maxRadius = Math.min(centerX, centerY) * 0.8;

        // Store current glyph data for snapshots and refresh
        currentGlyphData = {
            commits: commits,
            theme: theme,
            annotations: annotations,
            last_commit_sha: lastCommitSha
        };

        // Sort commits by date to establish a timeline
        commits.sort((a, b) => new Date(a.date) - new Date(b.date));

        const firstCommitDate = new Date(commits[0].date).getTime();
        const lastCommitDate = new Date(commits[commits.length - 1].date).getTime();
        const totalTimeSpan = lastCommitDate - firstCommitDate;

        // Assign unique colors to contributors
        const contributors = {};
        let colorIndex = 0;
        const colors = ["#FF5733", "#33FF57", "#3357FF", "#FF33F0", "#F0FF33", "#33F0FF"]; // Example colors

        // Define visual properties based on intent and sentiment
        const intentShapes = {
            "feature": "rect",
            "bug_fix": "circle",
            "refactor": "triangle", // Custom rendering needed for triangle
            "documentation": "ellipse",
            "style": "line",
            "test": "polygon", // Custom rendering needed for polygon
            "chore": "star", // Custom rendering needed for star
            "build": "diamond", // Custom rendering needed for diamond
            "ci": "hexagon", // Custom rendering needed for hexagon
            "performance": "path", // Custom rendering needed for path
            "revert": "cross", // Custom rendering needed for cross
            "configuration": "square",
            "merge": "arrow", // Custom rendering needed for arrow
            "other": "circle"
        };

        const sentimentColors = {
            "positive": "#4CAF50", // Green
            "negative": "#F44336", // Red
            "neutral": "#2196F3" // Blue
        };

        commits.forEach((commit, index) => {
            if (!contributors[commit.author_name]) {
                contributors[commit.author_name] = colors[colorIndex % colors.length];
                colorIndex++;
            }
            const commitColor = contributors[commit.author_name];

            const commitDate = new Date(commit.date).getTime();
            const timeRatio = totalTimeSpan > 0 ? (commitDate - firstCommitDate) / totalTimeSpan : 0;

            // Map time to a radius
            const radius = maxRadius * timeRatio;

            // Map commit frequency/index to an angle (simple example)
            const angle = (index / commits.length) * Math.PI * 2; // Full circle

            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);

            const baseNodeSize = parseFloat(document.getElementById('node-size').value);
            const branchThickness = parseFloat(document.getElementById('branch-thickness').value);

            // Calculate churn and influence node size
            const totalChurn = commit.total_additions + commit.total_deletions;
            // Normalize churn to a reasonable range for visual impact
            // Assuming a max churn of 1000 lines for significant impact, adjust as needed
            const normalizedChurn = Math.min(totalChurn / 500, 2); // Max 2x base size for very high churn
            const nodeSize = baseNodeSize * (1 + normalizedChurn * 0.5); // Increase size based on churn

            // Determine shape based on intent
            const shapeType = intentShapes[commit.intent] || intentShapes["other"];
            const fillColor = sentimentColors[commit.sentiment] || sentimentColors["neutral"];

            let element;
            switch (shapeType) {
                case "rect":
                case "square":
                    element = document.createElementNS("http://www.w3.org/2000/svg", "rect");
                    element.setAttribute("x", x - nodeSize / 2);
                    element.setAttribute("y", y - nodeSize / 2);
                    element.setAttribute("width", nodeSize);
                    element.setAttribute("height", nodeSize);
                    break;
                case "triangle":
                    element = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                    const trianglePoints = `${x},${y - nodeSize} ${x - nodeSize * 0.866},${y + nodeSize * 0.5} ${x + nodeSize * 0.866},${y + nodeSize * 0.5}`;
                    element.setAttribute("points", trianglePoints);
                    break;
                case "ellipse":
                    element = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
                    element.setAttribute("cx", x);
                    element.setAttribute("cy", y);
                    element.setAttribute("rx", nodeSize);
                    element.setAttribute("ry", nodeSize * 0.6);
                    break;
                case "polygon": // For test (e.g., pentagon)
                    element = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                    const numSides = 5; // Pentagon
                    let polygonPoints = "";
                    for (let i = 0; i < numSides; i++) {
                        const polyAngle = (i / numSides) * Math.PI * 2;
                        polygonPoints += `${x + nodeSize * Math.cos(polyAngle)},${y + nodeSize * Math.sin(polyAngle)} `;
                    }
                    element.setAttribute("points", polygonPoints.trim());
                    break;
                case "star": // For chore (e.g., 5-pointed star)
                    element = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                    const starPoints = [];
                    for (let i = 0; i < 10; i++) {
                        const r = (i % 2 === 0) ? nodeSize : nodeSize / 2;
                        const starAngle = Math.PI / 2 + i * Math.PI / 5;
                        starPoints.push(`${x + r * Math.cos(starAngle)},${y + r * Math.sin(starAngle)}`);
                    }
                    element.setAttribute("points", starPoints.join(" "));
                    break;
                case "diamond": // For build
                    element = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                    const diamondPoints = `${x},${y - nodeSize} ${x + nodeSize},${y} ${x},${y + nodeSize} ${x - nodeSize},${y}`;
                    element.setAttribute("points", diamondPoints);
                    break;
                case "hexagon": // For CI
                    element = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                    const hexPoints = [];
                    for (let i = 0; i < 6; i++) {
                        const hexAngle = (i / 6) * Math.PI * 2;
                        hexPoints.push(`${x + nodeSize * Math.cos(hexAngle)},${y + nodeSize * Math.sin(hexAngle)}`);
                    }
                    element.setAttribute("points", hexPoints.join(" "));
                    break;
                case "cross": // For revert
                    element = document.createElementNS("http://www.w3.org/2000/svg", "g");
                    const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    line1.setAttribute("x1", x - nodeSize / 2);
                    line1.setAttribute("y1", y - nodeSize / 2);
                    line1.setAttribute("x2", x + nodeSize / 2);
                    line1.setAttribute("y2", y + nodeSize / 2);
                    line1.setAttribute("stroke", fillColor);
                    line1.setAttribute("stroke-width", branchThickness);
                    element.appendChild(line1);
                    const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    line2.setAttribute("x1", x - nodeSize / 2);
                    line2.setAttribute("y1", y + nodeSize / 2);
                    line2.setAttribute("x2", x + nodeSize / 2);
                    line2.setAttribute("y2", y - nodeSize / 2);
                    line2.setAttribute("stroke", fillColor);
                    line2.setAttribute("stroke-width", branchThickness);
                    element.appendChild(line2);
                    break;
                case "arrow": // For merge
                    element = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                    const arrowHeadSize = nodeSize * 1.5;
                    const arrowPoints = `${x - arrowHeadSize / 2},${y - arrowHeadSize / 4} ${x + arrowHeadSize / 2},${y - arrowHeadSize / 4} ${x + arrowHeadSize / 2},${y - arrowHeadSize / 2} ${x + arrowHeadSize},${y} ${x + arrowHeadSize / 2},${y + arrowHeadSize / 2} ${x + arrowHeadSize / 2},${y + arrowHeadSize / 4} ${x - arrowHeadSize / 2},${y + arrowHeadSize / 4}`;
                    element.setAttribute("points", arrowPoints);
                    break;
                case "line": // For style
                    element = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    element.setAttribute("x1", x - nodeSize / 2);
                    element.setAttribute("y1", y);
                    element.setAttribute("x2", x + nodeSize / 2);
                    element.setAttribute("y2", y);
                    element.setAttribute("stroke", fillColor);
                    element.setAttribute("stroke-width", branchThickness);
                    break;
                case "circle":
                default:
                    element = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    element.setAttribute("cx", x);
                    element.setAttribute("cy", y);
                    element.setAttribute("r", nodeSize);
                    break;
            }

            if (shapeType !== "cross" && shapeType !== "line") { // Apply fill and stroke for non-line/cross shapes
                element.setAttribute("fill", fillColor);
                element.setAttribute("stroke", commitColor); // Use contributor color for stroke
                element.setAttribute("stroke-width", "1");
            }

            element.setAttribute("data-commit-sha", commit.sha);
            element.setAttribute("data-commit-message", commit.message);
            element.setAttribute("data-commit-author", commit.author_name);
            element.setAttribute("data-commit-date", new Date(commit.date).toLocaleString());
            element.setAttribute("data-commit-intent", commit.intent);
            element.setAttribute("data-commit-sentiment", commit.sentiment);
            element.setAttribute("data-commit-additions", commit.total_additions);
            element.setAttribute("data-commit-deletions", commit.total_deletions);
            element.setAttribute("data-commit-url", commit.commit_url || '');
            element.setAttribute("data-author-url", commit.author_url || '');
            element.setAttribute("data-pull-request-url", commit.pull_request_url || '');
            glyphSvg.appendChild(element);

            // Add tooltip event listeners
            element.addEventListener('mouseover', showTooltip);
            element.addEventListener('mouseout', hideTooltip);

            // Optional: Add a line connecting commits (simple branch visualization)
            if (index > 0) {
                const prevCommit = commits[index - 1];
                const prevTimeRatio = totalTimeSpan > 0 ? (new Date(prevCommit.date).getTime() - firstCommitDate) / totalTimeSpan : 0;
                const prevRadius = maxRadius * prevTimeRatio;
                const prevAngle = ((index - 1) / commits.length) * Math.PI * 2;
                const prevX = centerX + prevRadius * Math.cos(prevAngle);
                const prevY = centerY + prevRadius * Math.sin(prevAngle);

                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", prevX);
                line.setAttribute("y1", prevY);
                line.setAttribute("x2", x);
                line.setAttribute("y2", y);
                line.setAttribute("stroke", "#666");
                line.setAttribute("stroke-width", branchThickness);
                glyphSvg.appendChild(line);
            }
        });
        renderStoryAnnotations(annotations, commits, centerX, centerY, maxRadius, firstCommitDate, totalTimeSpan);

        shareGlyphBtn.style.display = 'block';
        shareLinkDiv.style.display = 'none';

        // Fetch and display glyph statistics
        const selectedRepo = repoSelect.value;
        if (selectedRepo) {
            const [provider, owner, repo] = selectedRepo.split('/');
            const startDate = startDateInput.value;
            const endDate = endDateInput.value;
            fetchGlyphStatistics(provider, owner, repo, startDate, endDate);
        }
    }

    shareGlyphBtn.addEventListener('click', async () => {
        const glyphData = glyphSvg.outerHTML;
        const commits = JSON.parse(localStorage.getItem('currentCommits')); // Retrieve commits for achievement calculation
        const metadata = {
            complexity_score: commits.length, // Simple example
            commit_count: commits.length,
            // Add more metadata as needed
            commits: commits // Include commits for achievement calculation on backend
        };

        try {
            const response = await fetch('http://localhost:8000/api/share-glyph', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ glyph_data: glyphData, metadata: metadata, annotations: storyAnnotations }),
            });
            if (response.ok) {
                const data = await response.json();
                shareLink.href = data.share_url;
                shareLink.textContent = data.share_url;
                embedSnippet.value = data.embed_snippet;
                shareLinkDiv.style.display = 'block';
            } else {
                console.error('Error sharing glyph:', response.status);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

    // Check if it's a shared glyph page or embed page
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length === 3 && pathParts[1] === 'glyph') {
        const shareId = pathParts[2];
        // Hide login and repo selection
        githubLoginBtn.style.display = 'none';
        gitlabLoginBtn.style.display = 'none';
        repositorySelectionDiv.style.display = 'none';
        shareGlyphBtn.style.display = 'none';

        async function fetchSharedGlyph() {
            try {
                const response = await fetch(`http://localhost:8000/api/glyph/${shareId}`);
                if (response.ok) {
                    const data = await response.json();
                    glyphSvg.innerHTML = data.glyph_data;
                    // Re-attach event listeners for shared glyphs
                    glyphSvg.querySelectorAll('circle, rect, polygon, ellipse, line, g').forEach(element => {
                        element.addEventListener('mouseover', showTooltip);
                        element.addEventListener('mouseout', hideTooltip);
                    });
                    // Render annotations for shared glyph
                    // Need to fetch commits to correctly position annotations
                    // For simplicity, we'll assume the shared glyph data contains enough info or re-fetch commits if necessary
                    // For now, we'll just pass an empty array for commits, which means annotations tied to SHA won't render correctly
                    renderStoryAnnotations(data.annotations, [], centerX, centerY, maxRadius, 0, 0); // Placeholder for commits data
                } else {
                    console.error('Error fetching shared glyph:', response.status);
                    glyphSvg.innerHTML = '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888">Glyph not found or expired.</text>';
                }
            } catch (error) {
                console.error('Error:', error);
                glyphSvg.innerHTML = '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888">Error loading glyph.</text>';
            }
        }
        fetchSharedGlyph();
    } else if (pathParts.length === 4 && pathParts[1] === 'embed' && pathParts[2] === 'glyph') {
        const shareId = pathParts[3];
        // This is an embed page, only show the glyph
        document.body.innerHTML = '<svg id="glyph-svg" width="100%" height="100%"></svg>';
        const embedGlyphSvg = document.getElementById('glyph-svg');
        const embedTooltip = document.createElement('div');
        embedTooltip.id = 'tooltip';
        embedTooltip.classList.add('tooltip');
        embedTooltip.style.display = 'none';
        document.body.appendChild(embedTooltip);

        async function fetchEmbedGlyph() {
            try {
                const response = await fetch(`http://localhost:8000/embed/glyph/${shareId}`);
                if (response.ok) {
                    const data = await response.json();
                    embedGlyphSvg.innerHTML = data.glyph_data;
                    embedGlyphSvg.querySelectorAll('circle, rect, polygon, ellipse, line, g').forEach(element => {
                        element.addEventListener('mouseover', showTooltip);
                        element.addEventListener('mouseout', hideTooltip);
                    });
                    // For embedded glyphs, we also need to render annotations
                    // This assumes the embed endpoint returns glyph_data and annotations
                    // We need the commits data to correctly position annotations, which is not available here.
                    // A more robust solution would involve passing commit data or pre-calculating annotation positions on the backend.
                    // For now, we'll pass an empty array for commits, meaning SHA-based annotations won't render correctly.
                    renderStoryAnnotations(data.annotations, [], embedGlyphSvg.clientWidth / 2, embedGlyphSvg.clientHeight / 2, Math.min(embedGlyphSvg.clientWidth, embedGlyphSvg.clientHeight) * 0.8 / 2, 0, 0); // Placeholder for commits data
                } else {
                    console.error('Error fetching embed glyph:', response.status);
                    embedGlyphSvg.innerHTML = '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888">Glyph not found or expired.</text>';
                }
            } catch (error) {
                console.error('Error:', error);
                embedGlyphSvg.innerHTML = '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888">Error loading glyph.</text>';
            }
        }
        fetchEmbedGlyph();
    }

    // Tooltip functions
    function showTooltip(event) {
        const tooltip = document.getElementById('tooltip');
        const commitSha = event.target.getAttribute('data-commit-sha');
        const commitMessage = event.target.getAttribute('data-commit-message');
        const commitAuthor = event.target.getAttribute('data-commit-author');
        const commitDate = event.target.getAttribute('data-commit-date');
        const commitIntent = event.target.getAttribute('data-commit-intent');
        const commitSentiment = event.target.getAttribute('data-commit-sentiment');
        const commitUrl = event.target.getAttribute('data-commit-url');
        const authorUrl = event.target.getAttribute('data-author-url');
        const pullRequestUrl = event.target.getAttribute('data-pull-request-url');

        tooltip.innerHTML = `
            <strong>SHA:</strong> ${commitSha.substring(0, 7)}<br>
            <strong>Message:</strong> ${commitMessage}<br>
            <strong>Author:</strong> ${commitAuthor} ${authorUrl ? `<a href="${authorUrl}" target="_blank">(Profile)</a>` : ''}<br>
            <strong>Date:</strong> ${commitDate}<br>
            <strong>Intent:</strong> ${commitIntent}<br>
            <strong>Sentiment:</strong> ${commitSentiment}<br>
            <strong>Additions:</strong> ${event.target.getAttribute('data-commit-additions')}<br>
            <strong>Deletions:</strong> ${event.target.getAttribute('data-commit-deletions')}<br>
            ${commitUrl ? `<a href="${commitUrl}" target="_blank">View Commit</a>` : ''}
            ${pullRequestUrl ? `<br><a href="${pullRequestUrl}" target="_blank">View Pull Request</a>` : ''}
        `;
        tooltip.style.display = 'block';
        tooltip.style.left = `${event.pageX + 10}px`;
        tooltip.style.top = `${event.pageY + 10}px`;
    }

    function hideTooltip() {
        const tooltip = document.getElementById('tooltip');
        tooltip.style.display = 'none';
    }

    // Gallery functions
    async function fetchGallery() {
        const sortBy = gallerySort.value;
        const filterTag = galleryFilterTag.value;
        let url = `http://localhost:8000/api/gallery?sort_by=${sortBy}`;
        if (filterTag) {
            url += `&filter_by_tag=${filterTag}`;
        }
        try {
            const response = await fetch(url);
            if (response.ok) {
                const galleryItems = await response.json();
                renderGallery(galleryItems);
            } else {
                console.error('Error fetching gallery:', response.status);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    function renderGallery(items) {
        galleryList.innerHTML = '';
        if (items.length === 0) {
            galleryList.innerHTML = '<p>No glyphs in the gallery yet.</p>';
            return;
        }
        items.forEach(item => {
            const galleryItemDiv = document.createElement('div');
            galleryItemDiv.classList.add('gallery-item');
            galleryItemDiv.innerHTML = `
                <h3>${item.title}</h3>
                <p>By: ${item.user_id}</p>
                <p>${item.description}</p>
                <p>Commits: ${item.commit_count}</p>
                <p>Complexity: ${item.complexity_score}</p>
                <p>Shared: ${new Date(item.created_at).toLocaleDateString()}</p>
                <button class="view-glyph-btn" data-share-id="${item.id}">View Glyph</button>
            `;
            galleryList.appendChild(galleryItemDiv);
        });

        galleryList.querySelectorAll('.view-glyph-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const shareId = event.target.dataset.shareId;
                // Redirect to the glyph view page or open in a modal
                window.open(`/glyph/${shareId}`, '_blank');
            });
        });
    }

    applyGalleryFiltersBtn.addEventListener('click', fetchGallery);
    gallerySort.addEventListener('change', fetchGallery);

    // Achievements functions
    async function fetchAchievements() {
        try {
            const userResponse = await fetch('http://localhost:8000/api/user');
            if (!userResponse.ok) {
                achievementsList.innerHTML = '<p>Please log in to view your achievements.</p>';
                return;
            }
            const userData = await userResponse.json();
            const userId = userData.login || userData.username; // GitHub uses login, GitLab uses username

            const achievementsResponse = await fetch(`http://localhost:8000/api/achievements/${userId}`);
            if (achievementsResponse.ok) {
                const achievements = await achievementsResponse.json();
                renderAchievements(achievements);
            } else {
                console.error('Error fetching achievements:', achievementsResponse.status);
                achievementsList.innerHTML = '<p>Error loading achievements.</p>';
            }
        } catch (error) {
            console.error('Error:', error);
            achievementsList.innerHTML = '<p>Error loading achievements.</p>';
        }
    }

    function renderAchievements(achievements) {
        achievementsList.innerHTML = '';
        if (achievements.length === 0) {
            achievementsList.innerHTML = '<p>No achievements unlocked yet. Keep coding!</p>';
            return;
        }
        achievements.forEach(achievement => {
            const achievementDiv = document.createElement('div');
            achievementDiv.classList.add('achievement-item');
            achievementDiv.innerHTML = `
                <h4>${achievement.title}</h4>
                <p>${achievement.description}</p>
            `;
            achievementsList.appendChild(achievementDiv);
        });
    }

    // Store commits in localStorage before generating glyph for achievement calculation
    generateGlyphBtn.addEventListener('click', async () => {
        const selectedRepo = repoSelect.value;
        if (selectedRepo) {
            const [provider, owner, repo] = selectedRepo.split('/');
            const startDate = startDateInput.value;
            const endDate = endDateInput.value;
            let url = `http://localhost:8000/api/commits/${provider}/${owner}/${repo}`;
            if (startDate) {
                url += `?start_date=${startDate}`;
            }
            if (endDate) {
                url += `${startDate ? '&' : '?'}end_date=${endDate}`;
            }
            try {
                const response = await fetch(url);
                if (response.ok) {
                    const commits = await response.json();
                    localStorage.setItem('currentCommits', JSON.stringify(commits)); // Store commits
                    generateAndVisualizeGlyph(commits, themeSelect.value, storyAnnotations);
                } else {
                    console.error('Error fetching commits:', response.status);
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
    });

    generateTeamGlyphBtn.addEventListener('click', async () => {
        if (selectedTeamRepos.length === 0) {
            alert('Please select at least one repository for the team glyph.');
            return;
        }

        const reposData = selectedTeamRepos.map(repo => {
            const [provider, owner, repoName] = repo.split('/');
            return { provider, owner, repo: repoName };
        });

        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const queryParams = new URLSearchParams();
        if (startDate) queryParams.append('start_date', startDate);
        if (endDate) queryParams.append('end_date', endDate);

        try {
            const response = await fetch(`http://localhost:8000/api/team-commits?${queryParams.toString()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reposData),
            });

            if (response.ok) {
                const commitsData = await response.json();
                localStorage.setItem('currentCommits', JSON.stringify(commitsData.commits)); // Store commits
                console.log('Fetched team commits:', commitsData.commits);
                generateAndVisualizeGlyph(commitsData.commits, themeSelect.value, storyAnnotations, commitsData.last_commit_sha);
            } else {
                console.error('Error fetching team commits:', response.status);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

});



    async function fetchGlyphStatistics(provider, owner, repo, startDate, endDate) {
        let url = `http://localhost:8000/api/glyph-statistics/${provider}/${owner}/${repo}`;
        const queryParams = new URLSearchParams();
        if (startDate) queryParams.append('start_date', startDate);
        if (endDate) queryParams.append('end_date', endDate);
        if (queryParams.toString()) {
            url += `?${queryParams.toString()}`;
        }

        try {
            const response = await fetch(url);
            if (response.ok) {
                const stats = await response.json();
                updateGlyphStatistics(stats);
            } else {
                console.error('Error fetching glyph statistics:', response.status);
                statsPanel.style.display = 'none';
            }
        } catch (error) {
            console.error('Error:', error);
            statsPanel.style.display = 'none';
        }
    }

    shareGlyphBtn.addEventListener('click', async () => {
        const glyphData = glyphSvg.outerHTML;
        const commits = JSON.parse(localStorage.getItem('currentCommits')); // Retrieve commits for achievement calculation
        const metadata = {
            complexity_score: commits.length, // Simple example
            commit_count: commits.length,
            // Add more metadata as needed
            commits: commits // Include commits for achievement calculation on backend
        };

        try {
            const response = await fetch('http://localhost:8000/api/share-glyph', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ glyph_data: glyphData, metadata: metadata, annotations: storyAnnotations }),
            });
            if (response.ok) {
                const data = await response.json();
                shareLink.href = data.share_url;
                shareLink.textContent = data.share_url;
                embedSnippet.value = data.embed_snippet;
                shareLinkDiv.style.display = 'block';
            } else {
                console.error('Error sharing glyph:', response.status);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

    // Check if it's a shared glyph page or embed page
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length === 3 && pathParts[1] === 'glyph') {
        const shareId = pathParts[2];
        // Hide login and repo selection
        githubLoginBtn.style.display = 'none';
        gitlabLoginBtn.style.display = 'none';
        repositorySelectionDiv.style.display = 'none';
        shareGlyphBtn.style.display = 'none';

        async function fetchSharedGlyph() {
            try {
                const response = await fetch(`http://localhost:8000/api/glyph/${shareId}`);
                if (response.ok) {
                    const data = await response.json();
                    glyphSvg.innerHTML = data.glyph_data;
                    // Re-attach event listeners for shared glyphs
                    glyphSvg.querySelectorAll('circle, rect, polygon, ellipse, line, g').forEach(element => {
                        element.addEventListener('mouseover', showTooltip);
                        element.addEventListener('mouseout', hideTooltip);
                    });
                    // Render annotations for shared glyph
                    // Need to fetch commits to correctly position annotations
                    // For simplicity, we'll assume the shared glyph data contains enough info or re-fetch commits if necessary
                    // For now, we'll just pass an empty array for commits, which means annotations tied to SHA won't render correctly
                    // A more robust solution would involve storing commits with the shared glyph or re-fetching them.
                    renderStoryAnnotations(data.annotations, [], centerX, centerY, maxRadius, 0, 0); // Placeholder for commits data
                } else {
                    console.error('Error fetching shared glyph:', response.status);
                    glyphSvg.innerHTML = '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888">Glyph not found or expired.</text>';
                }
            } catch (error) {
                console.error('Error:', error);
                glyphSvg.innerHTML = '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888">Error loading glyph.</text>';
            }
        }
        fetchSharedGlyph();
    } else if (pathParts.length === 4 && pathParts[1] === 'embed' && pathParts[2] === 'glyph') {
        const shareId = pathParts[3];
        // This is an embed page, only show the glyph
        document.body.innerHTML = '<svg id="glyph-svg" width="100%" height="100%"></svg>';
        const embedGlyphSvg = document.getElementById('glyph-svg');
        const embedTooltip = document.createElement('div');
        embedTooltip.id = 'tooltip';
        embedTooltip.classList.add('tooltip');
        embedTooltip.style.display = 'none';
        document.body.appendChild(embedTooltip);

        async function fetchEmbedGlyph() {
            try {
                const response = await fetch(`http://localhost:8000/embed/glyph/${shareId}`);
                if (response.ok) {
                    const data = await response.json();
                    embedGlyphSvg.innerHTML = data.glyph_data;
                    embedGlyphSvg.querySelectorAll('circle, rect, polygon, ellipse, line, g').forEach(element => {
                        element.addEventListener('mouseover', showTooltip);
                        element.addEventListener('mouseout', hideTooltip);
                    });
                    // For embedded glyphs, we also need to render annotations
                    // This assumes the embed endpoint returns glyph_data and annotations
                    // We need the commits data to correctly position annotations, which is not available here.
                    // A more robust solution would involve passing commit data or pre-calculating annotation positions on the backend.
                    // For now, we'll pass an empty array for commits, meaning SHA-based annotations won't render correctly.
                    renderStoryAnnotations(data.annotations, [], embedGlyphSvg.clientWidth / 2, embedGlyphSvg.clientHeight / 2, Math.min(embedGlyphSvg.clientWidth, embedGlyphSvg.clientHeight) * 0.8 / 2, 0, 0); // Placeholder for commits data
                } else {
                    console.error('Error fetching embed glyph:', response.status);
                    embedGlyphSvg.innerHTML = '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888">Glyph not found or expired.</text>';
                }
            } catch (error) {
                console.error('Error:', error);
                embedGlyphSvg.innerHTML = '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#888">Error loading glyph.</text>';
            }
        }
        fetchEmbedGlyph();
    }

    // Tooltip functions
    function showTooltip(event) {
        const tooltip = document.getElementById('tooltip');
        const commitSha = event.target.getAttribute('data-commit-sha');
        const commitMessage = event.target.getAttribute('data-commit-message');
        const commitAuthor = event.target.getAttribute('data-commit-author');
        const commitDate = event.target.getAttribute('data-commit-date');
        const commitIntent = event.target.getAttribute('data-commit-intent');
        const commitSentiment = event.target.getAttribute('data-commit-sentiment');
        const commitUrl = event.target.getAttribute('data-commit-url');
        const authorUrl = event.target.getAttribute('data-author-url');
        const pullRequestUrl = event.target.getAttribute('data-pull-request-url');

        tooltip.innerHTML = `
            <strong>SHA:</strong> ${commitSha.substring(0, 7)}<br>
            <strong>Message:</strong> ${commitMessage}<br>
            <strong>Author:</strong> ${commitAuthor} ${authorUrl ? `<a href="${authorUrl}" target="_blank">(Profile)</a>` : ''}<br>
            <strong>Date:</strong> ${commitDate}<br>
            <strong>Intent:</strong> ${commitIntent}<br>
            <strong>Sentiment:</strong> ${commitSentiment}<br>
            <strong>Additions:</strong> ${event.target.getAttribute('data-commit-additions')}<br>
            <strong>Deletions:</strong> ${event.target.getAttribute('data-commit-deletions')}<br>
            ${commitUrl ? `<a href="${commitUrl}" target="_blank">View Commit</a>` : ''}
            ${pullRequestUrl ? `<br><a href="${pullRequestUrl}" target="_blank">View Pull Request</a>` : ''}
        `;
        tooltip.style.display = 'block';
        tooltip.style.left = `${event.pageX + 10}px`;
        tooltip.style.top = `${event.pageY + 10}px`;
    }

    function hideTooltip() {
        const tooltip = document.getElementById('tooltip');
        tooltip.style.display = 'none';
    }

    // Gallery functions
    async function fetchGallery() {
        const sortBy = gallerySort.value;
        const filterTag = galleryFilterTag.value;
        let url = `http://localhost:8000/api/gallery?sort_by=${sortBy}`;
        if (filterTag) {
            url += `&filter_by_tag=${filterTag}`;
        }
        try {
            const response = await fetch(url);
            if (response.ok) {
                const galleryItems = await response.json();
                renderGallery(galleryItems);
            } else {
                console.error('Error fetching gallery:', response.status);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    }

    function renderGallery(items) {
        galleryList.innerHTML = '';
        if (items.length === 0) {
            galleryList.innerHTML = '<p>No glyphs in the gallery yet.</p>';
            return;
        }
        items.forEach(item => {
            const galleryItemDiv = document.createElement('div');
            galleryItemDiv.classList.add('gallery-item');
            galleryItemDiv.innerHTML = `
                <h3>${item.title}</h3>
                <p>By: ${item.user_id}</p>
                <p>${item.description}</p>
                <p>Commits: ${item.commit_count}</p>
                <p>Complexity: ${item.complexity_score}</p>
                <p>Shared: ${new Date(item.created_at).toLocaleDateString()}</p>
                <button class="view-glyph-btn" data-share-id="${item.id}">View Glyph</button>
            `;
            galleryList.appendChild(galleryItemDiv);
        });

        galleryList.querySelectorAll('.view-glyph-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const shareId = event.target.dataset.shareId;
                // Redirect to the glyph view page or open in a modal
                window.open(`/glyph/${shareId}`, '_blank');
            });
        });
    }

    applyGalleryFiltersBtn.addEventListener('click', fetchGallery);
    gallerySort.addEventListener('change', fetchGallery);

    // Achievements functions
    async function fetchAchievements() {
        try {
            const userResponse = await fetch('http://localhost:8000/api/user');
            if (!userResponse.ok) {
                achievementsList.innerHTML = '<p>Please log in to view your achievements.</p>';
                return;
            }
            const userData = await userResponse.json();
            const userId = userData.login || userData.username; // GitHub uses login, GitLab uses username

            const achievementsResponse = await fetch(`http://localhost:8000/api/achievements/${userId}`);
            if (achievementsResponse.ok) {
                const achievements = await achievementsResponse.json();
                renderAchievements(achievements);
            } else {
                console.error('Error fetching achievements:', achievementsResponse.status);
                achievementsList.innerHTML = '<p>Error loading achievements.</p>';
            }
        } catch (error) {
            console.error('Error:', error);
            achievementsList.innerHTML = '<p>Error loading achievements.</p>';
        }
    }

    function renderAchievements(achievements) {
        achievementsList.innerHTML = '';
        if (achievements.length === 0) {
            achievementsList.innerHTML = '<p>No achievements unlocked yet. Keep coding!</p>';
            return;
        }
        achievements.forEach(achievement => {
            const achievementDiv = document.createElement('div');
            achievementDiv.classList.add('achievement-item');
            achievementDiv.innerHTML = `
                <h4>${achievement.title}</h4>
                <p>${achievement.description}</p>
            `;
            achievementsList.appendChild(achievementDiv);
        });
    }

    // Store commits in localStorage before generating glyph for achievement calculation
    generateGlyphBtn.addEventListener('click', async () => {
        const selectedRepo = repoSelect.value;
        if (selectedRepo) {
            const [provider, owner, repo] = selectedRepo.split('/');
            const startDate = startDateInput.value;
            const endDate = endDateInput.value;
            let url = `http://localhost:8000/api/commits/${provider}/${owner}/${repo}`;
            if (startDate) {
                url += `?start_date=${startDate}`;
            }
            if (endDate) {
                url += `${startDate ? '&' : '?'}end_date=${endDate}`;
            }
            try {
                const response = await fetch(url);
                if (response.ok) {
                    const commits = await response.json();
                    localStorage.setItem('currentCommits', JSON.stringify(commits)); // Store commits
                    generateAndVisualizeGlyph(commits, themeSelect.value, storyAnnotations);
                } else {
                    console.error('Error fetching commits:', response.status);
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
    });

    generateTeamGlyphBtn.addEventListener('click', async () => {
        if (selectedTeamRepos.length === 0) {
            alert('Please select at least one repository for the team glyph.');
            return;
        }

        const reposData = selectedTeamRepos.map(repo => {
            const [provider, owner, repoName] = repo.split('/');
            return { provider, owner, repo: repoName };
        });

        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const queryParams = new URLSearchParams();
        if (startDate) queryParams.append('start_date', startDate);
        if (endDate) queryParams.append('end_date', endDate);

        try {
            const response = await fetch(`http://localhost:8000/api/team-commits?${queryParams.toString()}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reposData),
            });

            if (response.ok) {
                const commitsData = await response.json();
                localStorage.setItem('currentCommits', JSON.stringify(commitsData.commits)); // Store commits
                console.log('Fetched team commits:', commitsData.commits);
                generateAndVisualizeGlyph(commitsData.commits, themeSelect.value, storyAnnotations, commitsData.last_commit_sha);
            } else {
                console.error('Error fetching team commits:', response.status);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

});