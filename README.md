# 🕸️ SwarmNet Backend

**Private AI Intelligence Network** - Dollar Double Marketing | AI Profit Hustle + Digital King

## 🎯 Overview

SwarmNet is a private, secure backend system for managing AI agent swarms with real-time intelligence gathering, automated income tracking, and hierarchical bot management.

**PRIVATE ACCESS ONLY** - Single owner authentication with two-factor security.

## 🚀 Features

### Core Systems
- **🔐 Two-Factor Authentication** - Access key + verify phrase
- **📊 Real-time Dashboard** - Live KPIs, income tracking, bot status
- **🤖 Bot Management** - Hierarchical swarm control with master agents
- **💰 Income Tracking** - Automated revenue monitoring
- **📡 Intel Feed** - Real-time intelligence gathering
- **🎯 Lead Collection** - Automated lead capture and management
- **🔔 WebSocket Events** - Live updates via Socket.io
- **⏰ Scheduled Tasks** - Automated cron jobs for maintenance

### Security Features
- JWT token authentication
- Security event logging
- IP tracking for failed attempts
- Helmet.js security headers
- CORS protection

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Cache**: Redis (ioredis)
- **Real-time**: Socket.io
- **Auth**: JWT
- **Security**: Helmet, bcrypt
- **Scheduling**: node-cron

## 📦 Installation

```bash
# Clone repository
git clone https://github.com/BermudaLocals/SwarmNet-Backend.git
cd SwarmNet-Backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start server
npm start
```

## 🔧 Environment Variables

See `.env.example` for all required configuration:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - Secret for JWT tokens
- `OWNER_KEY` - Primary access key
- `OWNER_PHRASE` - Secondary verification phrase
- `FRONTEND_URL` - Frontend application URL
- `PORT` - Server port (default: 3000)

## 🗄️ Database Schema

Required PostgreSQL tables:
- `security_log` - Authentication and security events
- `income_events` - Revenue tracking
- `bots` - AI agent management
- `leads_collected` - Lead capture data
- `intel_feed` - Intelligence gathering
- `tasks` - Scheduled task management

## 🚀 Deployment

### Railway.app

1. Connect your GitHub repository
2. Configure environment variables
3. Add PostgreSQL and Redis plugins
4. Deploy automatically

See `railway.json` for build configuration.

## 🔒 Security

- **Private Access**: Only one owner can access the system
- **Two-Factor Auth**: Access key + verify phrase required
- **JWT Tokens**: 24-hour expiration
- **Security Logging**: All auth attempts logged with IP
- **CORS Protection**: Restricted to frontend URL
- **Helmet.js**: Security headers enabled

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - Owner login with two-factor auth

### Dashboard
- `GET /api/dashboard` - Live KPIs and statistics

### Bot Management
- `GET /api/bots` - List all bots
- `POST /api/bots` - Create new bot
- `PUT /api/bots/:id` - Update bot
- `DELETE /api/bots/:id` - Delete bot

### Income Tracking
- `GET /api/income` - Revenue statistics
- `POST /api/income` - Log income event

### Intel Feed
- `GET /api/intel` - Intelligence updates
- `POST /api/intel` - Add intel item
- `PUT /api/intel/:id/read` - Mark as read

### Leads
- `GET /api/leads` - Lead statistics
- `POST /api/leads` - Add new lead

## 🔄 WebSocket Events

- `bot:status` - Bot status updates
- `income:new` - New income event
- `intel:new` - New intelligence item
- `lead:new` - New lead captured
- `task:complete` - Scheduled task completed

## 📝 Version History

### v1.0.1 (Current)
- ✅ Fixed dependency issues
- ✅ Added helmet package
- ✅ Switched from redis to ioredis
- ✅ Added comprehensive documentation

### v1.0.0
- Initial release
- Core swarm management
- Two-factor authentication
- Real-time dashboard

## 📄 License

Private - All Rights Reserved

## 👤 Owner

AI Profit Hustle | Digital King

---

**⚠️ PRIVATE SYSTEM** - Unauthorized access is prohibited and logged.
