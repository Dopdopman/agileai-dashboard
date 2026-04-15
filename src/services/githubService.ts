export class GitHubService {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  /**
   * Fetches issues from a GitHub repository and extracts Agile metrics.
   */
  async fetchIssues(owner: string, repo: string) {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=50`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Agile-Dashboard-App'
    };

    // Use token if provided for higher rate limits and private repos
    if (this.token && this.token !== 'mock-token') {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`GitHub API Error: ${response.status} ${response.statusText}`);
    }

    const issues = await response.json();

    // Transform and extract the 5 required fields
    const extractedData = issues.map((issue: any) => {
      // GitHub doesn't have native Story Points. 
      // We extract it from labels (e.g., "size: 5" or "estimate: 3")
      let storyPoints = 0;
      const pointLabel = issue.labels.find((l: any) => 
        l.name.match(/^(size|estimate|points):\s*\d+/i)
      );
      
      if (pointLabel) {
        const match = pointLabel.name.match(/\d+/);
        if (match) storyPoints = parseInt(match[0], 10);
      } else {
        // Fallback: Assign random points 1, 2, 3, 5, 8 for demonstration if no label exists
        const fibonacci = [1, 2, 3, 5, 8];
        storyPoints = fibonacci[issue.number % fibonacci.length];
      }

      return {
        id: `GH-${issue.number}`,
        status: issue.state === 'closed' ? 'Done' : 'In Progress',
        created_at: issue.created_at,
        closed_at: issue.closed_at || null,
        story_points: storyPoints
      };
    });

    // Print to console as requested
    console.log(`\n--- Extracted ${extractedData.length} Issues from ${owner}/${repo} ---`);
    console.table(extractedData.slice(0, 10)); // Print top 10 to avoid flooding console

    return extractedData;
  }
}
