document.addEventListener('DOMContentLoaded', () => {
    const githubLoginBtn = document.getElementById('github-login');
    const repositorySelectionDiv = document.getElementById('repository-selection');
    const repoSelect = document.getElementById('repo-select');
    const generateGlyphBtn = document.getElementById('generate-glyph');
    const glyphSvg = document.getElementById('glyph-svg');

    githubLoginBtn.addEventListener('click', () => {
        window.location.href = 'http://localhost:8000/login/github';
    });

    // Check if authenticated and fetch repositories
    async function checkAuthAndFetchRepos() {
        try {
            const response = await fetch('http://localhost:8000/api/repositories');
            if (response.ok) {
                const repos = await response.json();
                githubLoginBtn.style.display = 'none';
                repositorySelectionDiv.style.display = 'block';
                repos.forEach(repo => {
                    const option = document.createElement('option');
                    option.value = repo.full_name;
                    option.textContent = repo.name;
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
        if (selectedRepo) {
            const [owner, repo] = selectedRepo.split('/');
            try {
                const response = await fetch(`http://localhost:8000/api/commits/${owner}/${repo}`);
                if (response.ok) {
                    const commits = await response.json();
                    console.log('Fetched commits:', commits);
                    generateAndVisualizeGlyph(commits);
                } else {
                    console.error('Error fetching commits:', response.status);
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
    });

    function generateAndVisualizeGlyph(commits) {
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
            return;
        }

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

        commits.forEach((commit, index) => {
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
            circle.setAttribute("fill", `hsl(${index * 10 % 360}, 70%, 50%)`); // Vary color
            circle.setAttribute("stroke", "#333");
            circle.setAttribute("stroke-width", "0.5");
            glyphSvg.appendChild(circle);

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
    }
});
