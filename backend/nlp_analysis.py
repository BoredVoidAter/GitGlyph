
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from collections import Counter
import re

# Download necessary NLTK data (run once)
try:
    nltk.data.find('corpora/stopwords')
except nltk.downloader.DownloadError:
    nltk.download('stopwords')
try:
    nltk.data.find('tokenizers/punkt')
except nltk.downloader.DownloadError:
    nltk.download('punkt')

def extract_keywords(text: str) -> list[str]:
    """
    Extracts keywords from a given text using NLTK.
    """
    stop_words = set(stopwords.words('english'))
    word_tokens = word_tokenize(text.lower())
    
    # Filter out stop words and non-alphabetic tokens
    filtered_words = [w for w in word_tokens if w.isalpha() and w not in stop_words]
    
    # Simple frequency-based keyword extraction
    # In a real scenario, you might use TF-IDF or other more advanced techniques
    word_counts = Counter(filtered_words)
    return [word for word, count in word_counts.most_common(5)] # Return top 5 keywords

def analyze_commit_for_goal_progress(commit_message: str, goal_keywords: list[str]) -> float:
    """
    Analyzes a single commit message for progress towards a goal.
    Returns a score based on how many goal keywords are found in the commit message.
    """
    commit_message_lower = commit_message.lower()
    score = 0
    for keyword in goal_keywords:
        if re.search(r'\b' + re.escape(keyword.lower()) + r'\b', commit_message_lower):
            score += 1
    return score

if __name__ == "__main__":
    # Example Usage
    commit_msg = "feat: Implement user authentication module and fix login bug"
    keywords = extract_keywords(commit_msg)
    print(f"Keywords: {keywords}")

    goal_keywords_example = ["authentication", "login", "module"]
    progress_score = analyze_commit_for_goal_progress(commit_msg, goal_keywords_example)
    print(f"Progress score for goal: {progress_score}")
