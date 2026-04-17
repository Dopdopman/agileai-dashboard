import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
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
        let issueTitle = issue.title;
        if (!issueTitle || typeof issueTitle !== 'string') {
          issueTitle = `GitHub Task #${issue.id}`;
        }

        await prisma.task.create({
          data: {
            id: issue.id,
            title: issueTitle,
            status: status,
            storyPoints: storyPoints,
            createdAt: issueCreatedAt,
            updatedAt: issue.updatedAt ? new Date(issue.updatedAt) : new Date(),
            startedAt: status !== 'To Do' ? issueCreatedAt : null,
            completedAt: issue.closedAt ? new Date(issue.closedAt) : null,
            projectId: defaultProject.id,
            sprintId: targetSprint.id,
            assigneeId: defaultUser.id,
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
