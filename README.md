# 📈 AgileAI - Smart Project Health Dashboard

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=google&logoColor=white)

AgileAI is a modern, full-stack application designed to help Agile teams and Scrum Masters visualize their project's health in real-time. By integrating standard Agile metrics with **Google Gemini AI**, the dashboard not only tracks progress but also acts as an automated Agile Coach, providing proactive risk analysis.

## ✨ Key Features

* **Real-time Agile Metrics:** Automatically calculates Sprint Velocity, Lead Time, Cycle Time, and Team Productivity based on actual issue data.
* **AI-Driven Risk Analysis:** Utilizes Google Gemini API to analyze current sprint metrics and provide actionable insights and risk percentages (On Track / At Risk / Critical).
* **Interactive Visualizations:** Built with Recharts for dynamic, responsive Sprint Burndown and Velocity charts.
* **GitHub Integration:** Fetches live repository issues and normalizes them into the database for accurate tracking.
* **Global Filters:** Seamlessly switch between different Sprints to view historical performance.

## 🏗 System Architecture

The application follows a decoupled client-server architecture:

1. **Frontend (Client):** React + Vite + Tailwind CSS. Hosted on **Vercel**.
2. **Backend (API):** Node.js + Express.js. Hosted on **Render**.
3. **Database:** PostgreSQL managed via Prisma ORM. Hosted on **Neon.tech**.
4. **AI Engine:** `@google/genai` SDK for real-time risk assessment.

## 🚀 Getting Started (Local Development)

### Prerequisites
* Node.js (v18 or higher)
* PostgreSQL database (or an active Neon.tech connection)
* Google Gemini API Key

### Installation

1. **Clone the repository**
   ```bash
   git clone [https://github.com/YOUR_GITHUB_USERNAME/agileai-dashboard.git](https://github.com/YOUR_GITHUB_USERNAME/agileai-dashboard.git)
   cd agileai-dashboard

2. **Install dependencies**

Bash
npm install

3. **Environment Setup**
Create a .env file in the root directory:

Đoạn mã
DATABASE_URL="postgresql://user:password@host/db"
GEMINI_API_KEY="your_gemini_api_key_here"
JWT_SECRET="your_secret_key"
PORT=3000

4. **Database Migration & Seeding**

Bash:
npx prisma generate
npx prisma db push
npm run seed

5. **Start the Development Server**

Bash: npm run dev

🌐 Live Demo
Frontend: https://agileai-dashboard.vercel.app

Backend API: https://agileai-dashboard.onrender.com

Developed with passion for modern Agile management.