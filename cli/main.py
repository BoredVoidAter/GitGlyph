
import argparse
import git
import svgwrite
import os

def generate_glyph(repo_path, output_path):
    """Generates a static SVG Glyph from a local Git repository."""
    try:
        repo = git.Repo(repo_path)
    except git.InvalidGitRepositoryError:
        print(f"Error: '{repo_path}' is not a valid Git repository.")
        return

    dwg = svgwrite.Drawing(output_path, profile='tiny', size=('100%', '100%'))
    dwg.add(dwg.rect((0, 0), ('100%', '100%'), fill='white'))

    # Simple visualization: each commit is a circle, tags are larger circles
    x_offset = 50
    y_offset = 50
    commit_spacing = 20

    commits = list(repo.iter_commits())
    commits.reverse() # Display chronologically

    for i, commit in enumerate(commits):
        x = x_offset + i * commit_spacing
        y = y_offset

        # Basic commit visualization
        dwg.add(dwg.circle((x, y), r=5, fill='blue', stroke='black', stroke_width=0.5))

        # Check for tags on this commit
        for tag in repo.tags:
            if tag.commit == commit:
                dwg.add(dwg.circle((x, y), r=10, fill='red', stroke='black', stroke_width=1,
                                   title=f"Tag: {tag.name}"))
                dwg.add(dwg.text(tag.name, insert=(x + 12, y + 5), fill='black', font_size='8px'))

    dwg.save()
    print(f"Glyph generated successfully at: {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Generate a GitGlyph SVG from a local Git repository.")
    parser.add_argument("repo_path", help="Path to the local Git repository.")
    parser.add_argument("-o", "--output", default="glyph.svg",
                        help="Output path for the SVG file (default: glyph.svg).")

    args = parser.parse_args()

    generate_glyph(args.repo_path, args.output)

if __name__ == "__main__":
    main()
