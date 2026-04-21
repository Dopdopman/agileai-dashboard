import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { GoogleGenAI, Type } from '@google/genai';
import { GitHubService } from './src/services/githubService.js';
import { JiraService } from './src/services/jiraService.js';
import { AgileMetricsService } from './src/services/AgileMetricsService.js';
import { prisma } from './src/lib/prisma.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'mock-key' });
const JWT_SECRET = process.env.JWT_SECRET || 'agile-dashboard-super-secret-key';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // --- CORS CONFIGURATION ---
  // Allow requests from Vercel frontend or fallback to '*' for local dev
  app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
  }));

  app.use(express.json());

  // --- AUTHENTICATION SYSTEM (JWT) ---
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    // Mock user validation (In production, verify against DB)
    const users: Record<string, { role: string, name: string }> = {
      'admin': { role: 'Admin', name: 'Alice Admin' },
      'manager': { role: 'Manager', name: 'Bob Manager' },
      'dev': { role: 'Developer', name: 'Charlie Dev' }
    };

    if (users[username] && password === 'password') {
      const user = users[username];
      const token = jwt.sign({ username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '8h' });
      res.json({ token, user });
    } else {
      res.status(401).json({ error: 'Invalid credentials. Use admin/password, manager/password, or dev/password' });
    }
  });

  // JWT Middleware
  const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      res.status(401).json({ error: 'Access denied. No token provided.' });
      return;
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        res.status(403).json({ error: 'Invalid token.' });
        return;
      }
      (req as any).user = user;
      next();
    });
  };

  const authorizeRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const user = (req as any).user;
      if (!user || !roles.includes(user.role)) {
        res.status(403).json({ error: 'Forbidden. Insufficient permissions.' });
        return;
      }
      next();
    };
  };

  // --- REAL DATA INTEGRATION (GITHUB API) ---
  app.post('/api/github/sync', authenticateToken, authorizeRole(['Admin', 'Manager']), async (req, res) => {
    const { repoOwner, repoName, githubToken } = req.body;
    
    if (!repoOwner || !repoName) {
      res.status(400).json({ error: 'Repository owner and name are required.' });
      return;
    }

    try {
      const defaultProject = await prisma.project.findFirst();
      const defaultUser = await prisma.user.findFirst();

      if (!defaultProject || !defaultUser) {
        res.status(400).json({ error: 'Missing default Project or User in database.' });
        return;
      }

      // Use the new Integration Module
      const githubService = new GitHubService(githubToken || process.env.GITHUB_TOKEN || '');
      const normalizedIssues = await githubService.fetchIssues(repoOwner, repoName);

      console.log("FIRST ISSUE FROM githubService:", normalizedIssues[0]);

      if (normalizedIssues.length === 0) {
        res.json({ message: 'Không tìm thấy issue nào từ GitHub.', sampleData: [] });
        return;
      }

      // 1. Xóa sạch dữ liệu Tasks và Sprints CŨ của defaultProject
      await prisma.task.deleteMany({ where: { projectId: defaultProject.id } });
      await prisma.sprint.deleteMany({ where: { projectId: defaultProject.id } });

      // 3. Tìm minDate và maxDate
      let minDate = new Date(normalizedIssues[0].createdAt || new Date());
      let maxDate = new Date(normalizedIssues[0].createdAt || new Date());

      for (const issue of normalizedIssues) {
        const createdAt = new Date(issue.createdAt || new Date());
        if (createdAt < minDate) minDate = createdAt;
        if (createdAt > maxDate) maxDate = createdAt;
        
        if (issue.closedAt) {
          const closedAt = new Date(issue.closedAt);
          if (closedAt > maxDate) maxDate = closedAt;
        }
      }

      // Đảm bảo maxDate > minDate ít nhất 1 chút để vòng lặp while hoạt động hiệu quả
      if (maxDate.getTime() === minDate.getTime()) {
        maxDate = new Date(minDate.getTime() + 14 * 24 * 60 * 60 * 1000);
      }

      // 4. Vòng lặp while nhảy 14 ngày tạo Sprints
      const generatedSprints = [];
      let currentStartDate = new Date(minDate);
      let sprintIndex = 1;

      while (currentStartDate <= maxDate) {
        const currentEndDate = new Date(currentStartDate.getTime() + 14 * 24 * 60 * 60 * 1000);
        
        const sprint = await prisma.sprint.create({
          data: {
            name: `Sprint ${sprintIndex}`,
            startDate: currentStartDate,
            endDate: currentEndDate,
            projectId: defaultProject.id
          }
        });
        
        generatedSprints.push(sprint);
        
        currentStartDate = currentEndDate; 
        sprintIndex++;
      }

      // Cứu cánh nếu array bị rỗng vì khoảng date quá bé
      if (generatedSprints.length === 0) {
        const sprint = await prisma.sprint.create({
          data: {
            name: 'Sprint 1',
            startDate: minDate,
            endDate: new Date(minDate.getTime() + 14 * 24 * 60 * 60 * 1000),
            projectId: defaultProject.id
          }
        });
        generatedSprints.push(sprint);
      }

      // 5. Quét mảng normalizedIssues phân bổ vào Tasks
      let syncedCount = 0;
      for (const issue of normalizedIssues) {
        // Map status (2)
        let status = 'To Do';
        if (issue.state === 'closed') {
          status = 'Done';
        } else if (issue.assignees && issue.assignees.length > 0) {
          status = 'In Progress';
        }

        // Map story points (random 1-5 if not available)
        const storyPoints = issue.storyPoints || Math.floor(Math.random() * 5) + 1;

        const issueCreatedAt = new Date(issue.createdAt || new Date());
        
        // Tìm sprint có khoảng startDate và endDate tương ứng với issue createdAt
        let targetSprint = generatedSprints.find(s => issueCreatedAt >= s.startDate && issueCreatedAt < s.endDate);
        if (!targetSprint) {
          // Fallback gán cho Sprint cuối cùng nếu có sai sót vượt range
          targetSprint = generatedSprints[generatedSprints.length - 1];
        }

        // Map title (fallback string)
        const safeTitle = issue.title ? String(issue.title) : `GitHub Task #${issue.id}`;

        await prisma.task.create({
          data: {
            id: issue.id,
            title: safeTitle,
            status: status,
            storyPoints: storyPoints,
            createdAt: issueCreatedAt,
            updatedAt: issue.updatedAt ? new Date(issue.updatedAt) : new Date(),
            startedAt: status !== 'To Do' ? issueCreatedAt : null,
            completedAt: issue.closedAt ? new Date(issue.closedAt) : null,
            projectId: defaultProject.id,
            sprintId: targetSprint.id,
            assigneeId: null,
          }
        });
        syncedCount++;
      }

      // 6. Trả result API thành công
      res.json({ 
        message: `Đã dọn dẹp và phân bổ ${syncedCount} tasks vào ${generatedSprints.length} Sprints lịch sử.`,
        sampleData: normalizedIssues.slice(0, 2) 
      });
    } catch (error: any) {
      console.error("Sync Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- REAL DATA INTEGRATION (JIRA API) ---
  app.post('/api/jira/sync', authenticateToken, authorizeRole(['Admin', 'Manager']), async (req, res) => {
    const { domain, email, apiToken, boardId } = req.body;
    
    if (!domain || !email || !apiToken || !boardId) {
      res.status(400).json({ error: 'domain, email, apiToken, and boardId are required.' });
      return;
    }

    try {
      const defaultProject = await prisma.project.findFirst();
      if (!defaultProject) {
        res.status(400).json({ error: 'Missing default Project in database.' });
        return;
      }

      const jiraService = new JiraService(domain, email, apiToken);
      
      const sprintsData = await jiraService.fetchSprints(boardId);
      const issuesData = await jiraService.fetchIssues(boardId);

      // 1. Clear old data
      await prisma.task.deleteMany({ where: { projectId: defaultProject.id } });
      await prisma.sprint.deleteMany({ where: { projectId: defaultProject.id } });

      // 2. Save Sprints
      const savedSprints = [];
      for (const sprint of sprintsData) {
        const startDate = sprint.startDate ? new Date(sprint.startDate) : new Date();
        const endDate = sprint.endDate ? new Date(sprint.endDate) : new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000);
        
        const newSprint = await prisma.sprint.create({
          data: {
            name: sprint.name || `Sprint ${sprint.id}`,
            startDate,
            endDate,
            projectId: defaultProject.id,
          }
        });
        savedSprints.push({ jiraId: sprint.id, prismaId: newSprint.id });
      }

      const sprintIdMap = new Map(savedSprints.map(s => [s.jiraId, s.prismaId]));

      // 3. Upsert Users (Assignees)
      const userMap = new Map();
      for (const issue of issuesData) {
        if (issue.assignee) {
          if (!userMap.has(issue.assignee.accountId)) {
            const dummyEmail = `${issue.assignee.accountId}@jira.local`;
            const upsertedUser = await prisma.user.upsert({
                where: { email: dummyEmail },
                update: { name: issue.assignee.displayName },
                create: { 
                  name: issue.assignee.displayName, 
                  email: dummyEmail,
                  role: 'Developer'
                }
            });
            userMap.set(issue.assignee.accountId, upsertedUser.id);
          }
        }
      }

      const defaultUser = await prisma.user.findFirst();

      // 4. Save Tasks
      let syncedCount = 0;
      for (const issue of issuesData) {
         let prismaSprintId: string | undefined = sprintIdMap.get(issue.sprintId);
         if (!prismaSprintId && savedSprints.length > 0) {
            prismaSprintId = savedSprints[savedSprints.length - 1].prismaId; // Fallback to last sprint
         } else if (!prismaSprintId) {
            prismaSprintId = undefined; // Fix Prisma type mismatch 
         }

         let prismaAssigneeId: string | null = issue.assignee ? userMap.get(issue.assignee.accountId) : null;

         await prisma.task.create({
           data: {
             id: `JIRA-${issue.key}`,
             title: issue.title,
             status: issue.status,
             storyPoints: issue.storyPoints || 0,
             createdAt: new Date(issue.createdAt || new Date()),
             updatedAt: new Date(issue.updatedAt || new Date()),
             startedAt: issue.status !== 'To Do' ? new Date(issue.createdAt || new Date()) : null,
             completedAt: issue.status === 'Done' ? new Date(issue.updatedAt || new Date()) : null,
             projectId: defaultProject.id,
             sprintId: prismaSprintId,
             assigneeId: prismaAssigneeId,
           }
         });
         syncedCount++;
      }

      res.json({
        message: `Đã đồng bộ thành công ${syncedCount} tasks và ${savedSprints.length} Sprints từ Jira.`,
        sampleData: issuesData.slice(0, 2)
      });
      
    } catch (error: any) {
      console.error("Jira Sync Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- DASHBOARD ENDPOINTS (REAL DATA FROM PRISMA) ---

  app.get('/api/sprints', authenticateToken, async (req, res) => {
    try {
      const sprints = await prisma.sprint.findMany({
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          tasks: {
            select: {
              id: true,
              title: true,
              status: true,
              storyPoints: true,
              createdAt: true,
              startedAt: true,
              completedAt: true,
              assignee: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        orderBy: {
          startDate: 'desc'
        }
      });
      res.json(sprints);
    } catch (error) {
      console.error('Error fetching sprints:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Helper to get sprintId from query or fallback to the first sprint in DB
  const getSprintId = async (req: Request, res: Response) => {
    let sprintId = req.query.sprintId as string;
    if (!sprintId) {
      const sprint = await prisma.sprint.findFirst({ orderBy: { startDate: 'desc' } });
      if (sprint) {
        sprintId = sprint.id;
      } else {
        res.status(404).json({ error: 'No sprints found in database.' });
        return null;
      }
    }
    return sprintId;
  };

  app.get('/api/metrics/velocity', authenticateToken, async (req, res) => {
    try {
      const sprintId = await getSprintId(req, res);
      if (!sprintId) return;
      const velocity = await AgileMetricsService.calculateVelocity(sprintId);
      res.json({ velocity });
    } catch (error) {
      console.error('Error fetching velocity:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/metrics/burndown', authenticateToken, async (req, res) => {
    try {
      const sprintId = await getSprintId(req, res);
      if (!sprintId) return;
      const burndownData = await AgileMetricsService.getBurndownData(sprintId);
      res.json(burndownData);
    } catch (error) {
      console.error('Error fetching burndown data:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/metrics/cycle-time', authenticateToken, async (req, res) => {
    try {
      const sprintId = await getSprintId(req, res);
      if (!sprintId) return;
      const cycleTime = await AgileMetricsService.calculateCycleTime(sprintId);
      res.json({ cycleTime });
    } catch (error) {
      console.error('Error fetching cycle time:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/metrics/lead-time', authenticateToken, async (req, res) => {
    try {
      const sprintId = await getSprintId(req, res);
      if (!sprintId) return;
      const leadTime = await AgileMetricsService.calculateLeadTime(sprintId);
      res.json({ leadTime });
    } catch (error) {
      console.error('Error fetching lead time:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/metrics/productivity', authenticateToken, async (req, res) => {
    try {
      const sprintId = await getSprintId(req, res);
      if (!sprintId) return;
      const productivity = await AgileMetricsService.calculateTeamProductivity(sprintId);
      
      // Enhance productivity data with user names
      const enhancedProductivity = await Promise.all(productivity.map(async (p) => {
        if (p.assigneeId === 'unassigned') {
          return { ...p, userName: 'Unassigned' };
        }
        const user = await prisma.user.findUnique({ where: { id: p.assigneeId! } });
        return {
          ...p,
          userName: user?.name || 'Unknown User'
        };
      }));
      
      res.json(enhancedProductivity);
    } catch (error) {
      console.error('Error fetching productivity:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  app.get('/api/issues/drilldown', authenticateToken, (req, res) => {
    // Dummy endpoint to prevent 404s on frontend drilldown clicks
    res.json([]);
  });

  // --- AI MODULE ENHANCEMENT (ML + LLM) ---
  app.post('/api/ai/insights', authenticateToken, async (req, res) => {
    try {
      const sprintId = await getSprintId(req, res);
      if (!sprintId) return;

      const { scopeCreepCount } = req.body || {};

      // Fetch real metrics
      const velocity = await AgileMetricsService.calculateVelocity(sprintId);
      const cycleTime = await AgileMetricsService.calculateCycleTime(sprintId);
      const leadTime = await AgileMetricsService.calculateLeadTime(sprintId);

      // Fetch task data
      const allTasks = await prisma.task.findMany({ where: { sprintId } });
      const totalPoints = allTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      const completedPoints = allTasks.filter(t => t.status === 'Done' || t.status === 'closed' || t.status === 'Complete').reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      const remainingPoints = totalPoints - completedPoints;
      
      const inProgressTasks = allTasks.filter(t => t.status === 'In Progress' || t.status === 'Review' || t.status === 'In Dev');
      const inProgressDetails = inProgressTasks.map(t => `- [${t.id}] ${t.title} (${t.storyPoints || 0} pts)`).join('\n');

      let scopeCreepInstruction = "";
      if (typeof scopeCreepCount === 'number' && scopeCreepCount > 0) {
        scopeCreepInstruction = `
        Here is the scope creep data: ${scopeCreepCount} tasks were added after the sprint started.
        RULE: If scopeCreepCount is greater than 0, you MUST explicitly warn about 'Scope Creep' in the 'Risk' section. You must state that adding tasks mid-sprint threatens the sprint goal and recommend strictly managing changes.
        `;
      }

      const prompt = `
        You are a Senior Agile Coach.
        Analyze the following project metrics for the current sprint and provide an Executive Summary in English.
        Make it sound professional, natural, and insightful. Tell a 'data story'.
        
        Metrics:
        - Total Sprint Points: ${totalPoints} pts
        - Completed Points: ${completedPoints} pts
        - Remaining Points: ${remainingPoints} pts
        - Historical Velocity: ${velocity} pts
        - Average Cycle Time: ${cycleTime} days
        - Average Lead Time: ${leadTime} days
        
        Tasks CURRENTLY IN PROGRESS:
        ${inProgressDetails || 'No tasks currently in progress.'}

        ${scopeCreepInstruction}

        MUST return a valid JSON object with the following structure:
        {
          "riskPercentage": A number from 0-100 indicating sprint delay risk,
          "analysis": "Provide a 1-2 paragraph Executive Summary. Tell a 'data story' about the sprint's health, bottlenecks (if any based on cycle time or specific pending tasks), and next steps. Make it flow naturally. Use Markdown bold (**) to highlight key numbers or task IDs. DO NOT use 1,2,3 lists."
        }
        Note: Ensure 'analysis' supports line breaks (\\n) for UI display.
      `;

      let insightData = {
        riskPercentage: 15,
        analysis: `The sprint is currently on track with a solid velocity of **${velocity} pts**. There are no significant bottlenecks identified at the moment, but the team should maintain this momentum to ensure all remaining **${remainingPoints} pts** are delivered successfully.`
      };
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey !== 'mock-key' && apiKey !== 'MY_GEMINI_API_KEY') {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-preview',
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  riskPercentage: {
                    type: Type.NUMBER,
                    description: "Risk percentage from 0 to 100",
                  },
                  analysis: {
                    type: Type.STRING,
                    description: "Detailed analysis with 3 markdown sections",
                  },
                },
                required: ["riskPercentage", "analysis"],
              },
            },
          });
          
          if (response.text) {
            insightData = JSON.parse(response.text.trim());
          }
        } catch (e: any) {
          console.warn("Gemini API error (using fallback insight):", e.message || e);
        }
      }

      res.json(insightData);
    } catch (error) {
      console.error('Error fetching AI insights:', error);
      res.status(500).json({ error: 'Failed to generate AI insights' });
    }
  });

  app.get('/api/ai/retrospective', authenticateToken, async (req, res) => {
    try {
      const sprintId = await getSprintId(req, res);
      if (!sprintId) return;

      const allTasks = await prisma.task.findMany({ where: { sprintId } });
      const completedTasks = allTasks.filter(t => t.status === 'Done' || t.status === 'closed' || t.status === 'Complete');
      const inProgressTasks = allTasks.filter(t => t.status !== 'Done' && t.status !== 'closed' && t.status !== 'Complete');
      
      const completionRate = allTasks.length > 0 ? (completedTasks.length / allTasks.length) * 100 : 0;
      const blockers = inProgressTasks.filter(t => t.status === 'Blocked' || t.title.toLowerCase().includes('bug'));

      const prompt = `
        You are an expert Agile Coach.
        Generate a Sprint Retrospective Report based on these metrics:
        - Total Tasks: ${allTasks.length}
        - Completed: ${completedTasks.length} (${completionRate.toFixed(1)}%)
        - Incomplete: ${inProgressTasks.length}
        - Potential Blockers/Bugs detected: ${blockers.length}
        
        Write the report in Markdown with exactly these 3 headings:
        ### ✅ What went well
        ### ❌ What could be improved
        ### 🎯 Action Items
        
        Make it actionable and natural. Avoid JSON, return raw markdown text.
      `;

      let retrospectiveMD = `### ✅ What went well\n- The team maintained good focus on core deliverables.\n- Stable completion rate for high-priority tasks.\n\n### ❌ What could be improved\n- Some tasks remained in progress at the end of the sprint.\n- A few blockers might have slowed down the momentum.\n\n### 🎯 Action Items\n- Review pending tasks in the backlog.\n- Discuss blockers in the next daily standup.\n- Plan capacity strictly for the next sprint.`;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey !== 'mock-key' && apiKey !== 'MY_GEMINI_API_KEY') {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-preview',
            contents: prompt,
            config: {
              responseMimeType: "text/plain",
            },
          });
          
          if (response.text) {
            retrospectiveMD = response.text.trim();
          }
        } catch (e: any) {
          console.warn("Gemini API error (using fallback retro):", e.message || e);
        }
      }

      res.json({ report: retrospectiveMD });
    } catch (error) {
      console.error('Error fetching AI retrospective:', error);
      res.status(500).json({ error: 'Failed to generate AI retrospective' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
