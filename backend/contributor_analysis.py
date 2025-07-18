
import git

def analyze_contributor_collaboration(repo_path):
    """
    Analyzes Git history to determine collaboration strength between contributors.
    Returns data suitable for a force-directed graph.
    """
    repo = git.Repo(repo_path)
    contributors = {}
    file_contributions = {}

    for commit in repo.iter_commits():
        author_email = commit.author.email
        if author_email not in contributors:
            contributors[author_email] = {'name': commit.author.name, 'email': author_email, 'commits': 0, 'files': set()}
        contributors[author_email]['commits'] += 1

        for file_path in commit.stats.files:
            if file_path not in file_contributions:
                file_contributions[file_path] = set()
            file_contributions[file_path].add(author_email)
            contributors[author_email]['files'].add(file_path)

    nodes = []
    for email, data in contributors.items():
        nodes.append({'id': email, 'name': data['name'], 'commits': data['commits']})

    links = []
    processed_pairs = set()

    for file_path, authors in file_contributions.items():
        author_list = list(authors)
        for i in range(len(author_list)):
            for j in range(i + 1, len(author_list)):
                author1 = author_list[i]
                author2 = author_list[j]

                # Ensure consistent order for pair processing
                pair = tuple(sorted((author1, author2)))

                if pair not in processed_pairs:
                    collaboration_strength = 0
                    # Calculate collaboration strength based on shared files
                    shared_files = len(contributors[author1]['files'].intersection(contributors[author2]['files']))
                    collaboration_strength = shared_files # Simple metric for now

                    if collaboration_strength > 0:
                        links.append({'source': author1, 'target': author2, 'value': collaboration_strength})
                    processed_pairs.add(pair)

    return {'nodes': nodes, 'links': links}

if __name__ == '__main__':
    # Example usage (replace with actual repo path)
    # For testing, you might need a small local git repo
    # repo_path = '/path/to/your/git/repo'
    # constellation_data = analyze_contributor_collaboration(repo_path)
    # import json
    # print(json.dumps(constellation_data, indent=2))
    pass
