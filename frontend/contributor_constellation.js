document.addEventListener('DOMContentLoaded', () => {
    const loadConstellationBtn = document.getElementById('loadConstellation');
    const repoPathInput = document.getElementById('repoPath');
    const constellationContainer = document.getElementById('constellation-container');

    loadConstellationBtn.addEventListener('click', async () => {
        const repoPath = repoPathInput.value;
        if (!repoPath) {
            alert('Please enter a Git repository path.');
            return;
        }

        constellationContainer.innerHTML = 'Loading...';

        try {
            const response = await fetch(`http://localhost:8000/api/contributor-constellation?repo_path=${encodeURIComponent(repoPath)}`, {
                headers: {
                    'X-API-Key': 'test_api_key' // Replace with actual API key or authentication mechanism
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            renderConstellation(data);
        } catch (error) {
            console.error('Error fetching constellation data:', error);
            constellationContainer.innerHTML = `<p style="color: red;">Error loading constellation: ${error.message}. Please ensure the backend is running and the repository path is valid.</p>`;
        }
    });

    function renderConstellation(data) {
        constellationContainer.innerHTML = ''; // Clear previous content

        const width = constellationContainer.clientWidth;
        const height = constellationContainer.clientHeight;

        const svg = d3.select(constellationContainer).append('svg')
            .attr('width', width)
            .attr('height', height);

        const simulation = d3.forceSimulation(data.nodes)
            .force('link', d3.forceLink(data.links).id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2));

        const link = svg.append('g')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .selectAll('line')
            .data(data.links)
            .join('line')
            .attr('stroke-width', d => Math.sqrt(d.value));

        const node = svg.append('g')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5)
            .selectAll('circle')
            .data(data.nodes)
            .join('circle')
            .attr('r', 10)
            .attr('fill', 'steelblue')
            .call(drag(simulation));

        node.append('title')
            .text(d => d.name);

        const labels = svg.append('g')
            .attr('class', 'labels')
            .selectAll('text')
            .data(data.nodes)
            .enter()
            .append('text')
            .attr('class', 'node-label')
            .attr('dx', 12)
            .attr('dy', '.35em')
            .text(d => d.name);

        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);
            
            labels
                .attr('x', d => d.x)
                .attr('y', d => d.y);
        });

        function drag(simulation) {
            function dragstarted(event) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            }

            function dragged(event) {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            }

            function dragended(event) {
                if (!event.active) simulation.alphaTarget(0);
                event.subject.fx = null;
                event.subject.fy = null;
            }

            return d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended);
        }
    }
});