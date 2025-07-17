document.addEventListener('DOMContentLoaded', () => {
    const githubLoginBtn = document.getElementById('github-login');
    const gitlabLoginBtn = document.getElementById('gitlab-login');
    const repositorySelectionDiv = document.getElementById('repository-selection');
    const repoSelect = document.getElementById('repo-select');
    const generateGlyphBtn = document.getElementById('generate-glyph');
    const glyphSvg = document.getElementById('glyph-svg');
    const themeSelect = document.getElementById('theme-select');
    const shareGlyphBtn = document.getElementById('share-glyph');
    const shareLinkDiv = document.getElementById('share-link-div');
    const shareLink = document.getElementById('share-link');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');

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
                    const commits = await response.json();
                    console.log('Fetched commits:', commits);
                    generateAndVisualizeGlyph(commits, selectedTheme); // Pass theme to visualization function
                } else {
                    console.error('Error fetching commits:', response.status);
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
    });

    function generateAndVisualizeGlyph(commits, theme) {
        // Simple Glyph Generation Algorithm (Placeholder)
        // This is a very basic example. A real algorithm would be much more complex.

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
            return;
        }

        applyTheme(theme);

        const svgWidth = parseInt(glyphSvg.getAttribute('width'));
        const svgHeight = parseInt(glyphSvg.getAttribute('height'));
        const centerX = svgWidth / 2;
        const centerY = svgHeight / 2;
        const maxRadius = Math.min(centerX, centerY) * 0.8;

        // Sort commits by date to establish a timeline
        commits.sort((a, b) => new Date(a.date) - new Date(b.date));

        const firstCommitDate = new Date(commits[0].date).getTime();
        const lastCommitDate = new Date(commits[commits.length - 1].date).getTime();
        const totalTimeSpan = lastCommitDate - firstCommitDate;

        // Assign unique colors to contributors
        const contributors = {};
        let colorIndex = 0;
        const colors = ["#FF5733", "#33FF57", "#3357FF", "#FF33F0", "#F0FF33", "#33F0FF"]; // Example colors

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

            // Create a circle for each commit
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", x);
            circle.setAttribute("cy", y);
            circle.setAttribute("r", 3 + (commit.message.length % 5)); // Vary size based on message length
            circle.setAttribute("fill", commitColor); // Use contributor color
            circle.setAttribute("stroke", "#333");
            circle.setAttribute("stroke-width", "0.5");
            circle.setAttribute("data-commit-sha", commit.sha);
            circle.setAttribute("data-commit-message", commit.message);
            circle.setAttribute("data-commit-author", commit.author_name);
            circle.setAttribute("data-commit-date", new Date(commit.date).toLocaleString());
            glyphSvg.appendChild(circle);

            // Add tooltip event listeners
            circle.addEventListener('mouseover', showTooltip);
            circle.addEventListener('mouseout', hideTooltip);

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
                line.setAttribute("stroke-width", "1");
                glyphSvg.appendChild(line);
            }
        });
        shareGlyphBtn.style.display = 'block';
        shareLinkDiv.style.display = 'none';
    }

    shareGlyphBtn.addEventListener('click', async () => {
        const glyphData = glyphSvg.outerHTML;
        try {
            const response = await fetch('http://localhost:8000/api/share-glyph', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ glyph_data: glyphData }),
            });
            if (response.ok) {
                const data = await response.json();
                shareLink.href = data.share_url;
                shareLink.textContent = data.share_url;
                shareLinkDiv.style.display = 'block';
            } else {
                console.error('Error sharing glyph:', response.status);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    });

    // Check if it's a shared glyph page
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
                    glyphSvg.innerHTML = data;
                    // Re-attach event listeners for shared glyphs
                    glyphSvg.querySelectorAll('circle').forEach(circle => {
                        circle.addEventListener('mouseover', showTooltip);
                        circle.addEventListener('mouseout', hideTooltip);
                    });
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
    }

    // Tooltip functions
    function showTooltip(event) {
        const tooltip = document.getElementById('tooltip');
        const commitSha = event.target.getAttribute('data-commit-sha');
        const commitMessage = event.target.getAttribute('data-commit-message');
        const commitAuthor = event.target.getAttribute('data-commit-author');
        const commitDate = event.target.getAttribute('data-commit-date');

        tooltip.innerHTML = `
            <strong>SHA:</strong> ${commitSha.substring(0, 7)}<br>
            <strong>Message:</strong> ${commitMessage}<br>
            <strong>Author:</strong> ${commitAuthor}<br>
            <strong>Date:</strong> ${commitDate}
        `;
        tooltip.style.display = 'block';
        tooltip.style.left = `${event.pageX + 10}px`;
        tooltip.style.top = `${event.pageY + 10}px`;
    }

    function hideTooltip() {
        const tooltip = document.getElementById('tooltip');
        tooltip.style.display = 'none';
    }
});