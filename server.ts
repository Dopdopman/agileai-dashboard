import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import { GoogleGenAI, Type } from '@google/genai';
import { GitHubService } from './src/services/githubService.js';
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

  // --- ROOT ROUTE ---
  app.get('/', (req, res) => {
    res.send('AgileAI API Backend is running perfectly on Render! 🚀');
  });

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
      // Lấy Sprint, Project và User mặc định từ DB
      const currentSprint = await prisma.sprint.findFirst({
        orderBy: { startDate: 'desc' }
      });
      const defaultProject = await prisma.project.findFirst();
      const defaultUser = await prisma.user.findFirst();

      if (!currentSprint || !defaultProject) {
        res.status(400).json({ error: 'Missing required Sprint or Project in database.' });
        return;
      }

      // Fetch dữ liệu từ GitHub
      const githubService = new GitHubService(githubToken || process.env.GITHUB_TOKEN || '');
      const normalizedIssues = await githubService.fetchIssues(repoOwner, repoName);

      let syncedCount = 0;

      // Lưu dữ liệu thật vào Database
      for (const issue of normalizedIssues) {
        // Bọc thép dữ liệu: Xử lý ngày tháng an toàn
        const createdAt = issue.createdAt || issue.created_at ? new Date(issue.createdAt || issue.created_at) : new Date();
        const updatedAt = issue.updatedAt || issue.updated_at ? new Date(issue.updatedAt || issue.updated_at) : new Date();
        const title = issue.title || 'Untitled Task';
        
        // Trích xuất status
        let status = 'To Do';
        const issueState = (issue.state || '').toLowerCase();
        if (issueState === 'closed') {
          status = 'Done';
        } else if (issue.assignee) {
          status = 'In Progress';
        }

        // Random story points từ 1-5
        const storyPoints = Math.floor(Math.random() * 5) + 1;

        // Upsert vào bảng Task
        await prisma.task.upsert({
          where: { githubId: issue.id.toString() },
          update: {
            title,
            status,
            updatedAt
          },
          create: {
            githubId: issue.id.toString(),
            title,
            status,
            storyPoints,
            sprintId: currentSprint.id,
            projectId: defaultProject.id,
            assigneeId: defaultUser ? defaultUser.id : null,
            createdAt,
            updatedAt
          }
        });
        syncedCount++;
      }
      
      res.json({ 
        message: `Đã đồng bộ thành công ${syncedCount} tasks từ GitHub.`,
      });
    } catch (error: any) {
      console.error("Sync Error:", error);
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
          endDate: true
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
        const user = await prisma.user.findUnique({ where: { id: p.assigneeId! } });
        return {
          ...p,
          userName: user?.name || 'Unknown'
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
  app.get('/api/ai/insights', authenticateToken, async (req, res) => {
    try {
      const sprintId = await getSprintId(req, res);
      if (!sprintId) return;

      // Fetch real metrics
      const velocity = await AgileMetricsService.calculateVelocity(sprintId);
      const cycleTime = await AgileMetricsService.calculateCycleTime(sprintId);
      const leadTime = await AgileMetricsService.calculateLeadTime(sprintId);

      const prompt = `
        You are an expert Agile Coach and AI system.
        Analyze the following project metrics for the current sprint:
        - Current Velocity: ${velocity} points
        - Average Cycle Time: ${cycleTime} days
        - Average Lead Time: ${leadTime} days

        Provide a risk analysis for this sprint.
        Return a JSON object with:
        1. riskPercentage: A number between 0 and 100 representing the risk of the sprint failing or being delayed.
        2. analysis: A short 1-sentence actionable analysis (under 50 words).
      `;

      let insightData = {
        riskPercentage: 15,
        analysis: "Metrics look stable, but keep an eye on cycle time."
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
                    description: "Short analysis under 50 words",
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();