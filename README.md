```markdown
# 📈 AgileAI - Smart Project Health Dashboard

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Gemini%201.5%20Flash-8E75B2?style=for-the-badge&logo=google&logoColor=white)

AgileAI is a modern, full-stack application designed to help Agile teams and Scrum Masters visualize their project's health in real-time. By integrating standard Agile metrics with **Google Gemini 1.5 Flash API**, the dashboard not only tracks progress but also acts as an automated Agile Coach, providing proactive risk analysis and delay prediction.

## ✨ Key Features

* **Real-time Agile Metrics:** Automatically calculates Sprint Velocity, Lead Time, Cycle Time, and Team Productivity based on actual issue data.
* **AI-Driven Risk Analysis:** Utilizes Google Gemini 1.5 Flash to analyze current sprint metrics, detect Scope Creep, and provide actionable warnings (Risk Level: % / At Risk Issues).
* **Interactive Visualizations:** Built with Recharts for dynamic, responsive Sprint Burndown and Velocity charts.
* **Jira Integration (Real-time Sync):** Connects directly to Atlassian Jira via REST API to fetch live Sprints and task workflows into the local database.
* **Global Filters:** Seamlessly switch between different Sprints to view historical performance.

## 🏗 System Architecture

The application follows a decoupled client-server architecture:

1. **Frontend (Client):** React + Vite + Tailwind CSS. Hosted on **Vercel**.
2. **Backend (API):** Node.js + Express.js. Hosted on **Render**.
3. **Database (Local/Dev):** SQLite managed via Prisma ORM (Auto-generated `dev.db` for easy local setup without heavy dependencies).
4. **AI Engine:** `@google/genai` SDK for qualitative reasoning.

## 🚀 Getting Started (Local Development)

### Prerequisites
* Node.js (v18 or higher)
* Google Gemini API Key
* A Jira Account with an API Token (for syncing real data)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_GITHUB_USERNAME/agileai-dashboard.git
   cd agileai-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Database (Local SQLite)
   DATABASE_URL="file:./dev.db"
   
   # API Keys
   GEMINI_API_KEY="your_gemini_api_key_here"
   JWT_SECRET="your_secret_key"
   PORT=3000
   ```

4. **Database Migration & Seeding**
   ```bash
   npx prisma generate
   npx prisma db push
   npm run seed
   ```

5. **Start the Development Server**
   ```bash
   npm run dev
   ```

## 🌐 Live Demo
* **Frontend:** [https://agileai-dashboard.vercel.app](https://agileai-dashboard.vercel.app)
* **Backend API:** [https://agileai-dashboard.onrender.com](https://agileai-dashboard.onrender.com)

*Developed with passion for modern Agile management.*
```