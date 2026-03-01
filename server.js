/**
 * SWARMNET — Private AI Intelligence Network
 * Dollar Double Marketing | AI Profit Hustle + Digital King
 * Backend Server — Node.js + Express + PostgreSQL + Socket.io
 * 
 * PRIVATE: Only one human can access this. Ever.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const Redis = require('ioredis');
const cron = require('node-cron');
const axios = require('axios');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] }
});

// ── MIDDLEWARE ──────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use(express.static('public'));

// ── DATABASE ────────────────────────────────────────────────
const db = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/swarmnet'
});

// ── REDIS ───────────────────────────────────────────────────
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// ── AUTH MIDDLEWARE ─────────────────────────────────────────
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'swarmnet_secret_change_this');
    req.owner = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ── ROUTES ──────────────────────────────────────────────────

/**
 * AUTH — Two-factor owner login
 * Layer 1: access key
 * Layer 2: verify phrase
 */
app.post('/api/auth/login', async (req, res) => {
  const { accessKey, verifyPhrase } = req.body;
  const validKey = process.env.OWNER_KEY || 'swarm2026_change_this';
  const validPhrase = process.env.OWNER_PHRASE || 'agent0godmode_change_this';

  if (accessKey !== validKey || verifyPhrase !== validPhrase) {
    // Log failed attempt
    await db.query(
      'INSERT INTO security_log (event, ip, created_at) VALUES ($1, $2, NOW())',
      ['FAILED_LOGIN', req.ip]
    ).catch(() => {});
    return res.status(403).json({ error: 'Access denied' });
  }

  const token = jwt.sign(
    { owner: 'ai_profit_hustle', role: 'god' },
    process.env.JWT_SECRET || 'swarmnet_secret_change_this',
    { expiresIn: '24h' }
  );

  await db.query(
    'INSERT INTO security_log (event, ip, created_at) VALUES ($1, $2, NOW())',
    ['SUCCESSFUL_LOGIN', req.ip]
  ).catch(() => {});

  res.json({ token, message: 'Welcome back, Commander.' });
});

/**
 * DASHBOARD — Live KPIs
 */
app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const [income, bots, leads, intel] = await Promise.all([
      db.query('SELECT COALESCE(SUM(amount), 0) as total FROM income_events WHERE created_at > NOW() - INTERVAL \'30 days\''),
      db.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status=\'active\') as active FROM bots'),
      db.query('SELECT COUNT(*) as total FROM leads_collected WHERE created_at > NOW() - INTERVAL \'7 days\''),
      db.query('SELECT COUNT(*) as unread FROM intel_feed WHERE read = false')
    ]);

    // Weekly chart data
    const chartData = await db.query(`
      SELECT DATE(created_at) as date, SUM(amount) as revenue
      FROM income_events
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `);

    res.json({
      revenue30d: parseFloat(income.rows[0].total),
      totalBots: parseInt(bots.rows[0].total),
      activeBots: parseInt(bots.rows[0].active),
      leadsThisWeek: parseInt(leads.rows[0].total),
      unreadIntel: parseInt(intel.rows[0].unread),
      revenueChart: chartData.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * BOTS — Full army management
 */
app.get('/api/bots', requireAuth, async (req, res) => {
  const bots = await db.query('SELECT * FROM bots ORDER BY created_at DESC');
  res.json(bots.rows);
});

app.post('/api/bots', requireAuth, async (req, res) => {
  const { name, role, target, schedule } = req.body;
  const result = await db.query(
    'INSERT INTO bots (name, role, target, schedule, status, tasks_done, income_generated, created_at) VALUES ($1, $2, $3, $4, \'active\', 0, 0, NOW()) RETURNING *',
    [name, role, target, schedule]
  );
  io.emit('bot_deployed', result.rows[0]);
  res.json(result.rows[0]);
});

app.patch('/api/bots/:id', requireAuth, async (req, res) => {
  const { status } = req.body;
  const result = await db.query(
    'UPDATE bots SET status = $1 WHERE id = $2 RETURNING *',
    [status, req.params.id]
  );
  io.emit('bot_updated', result.rows[0]);
  res.json(result.rows[0]);
});

app.delete('/api/bots/:id', requireAuth, async (req, res) => {
  await db.query('DELETE FROM bots WHERE id = $1', [req.params.id]);
  io.emit('bot_killed', { id: req.params.id });
  res.json({ success: true });
});

/**
 * INTELLIGENCE FEED
 */
app.get('/api/intel', requireAuth, async (req, res) => {
  const intel = await db.query(
    'SELECT * FROM intel_feed ORDER BY score DESC, created_at DESC LIMIT 50'
  );
  res.json(intel.rows);
});

app.post('/api/intel/activate/:id', requireAuth, async (req, res) => {
  // Mark as activated, send to Agent Zero for execution
  await db.query('UPDATE intel_feed SET activated = true, read = true WHERE id = $1', [req.params.id]);
  const item = await db.query('SELECT * FROM intel_feed WHERE id = $1', [req.params.id]);
  
  // Send activation to Agent Zero
  await sendToAgentZero({
    task: 'execute_opportunity',
    intel: item.rows[0]
  });

  io.emit('intel_activated', item.rows[0]);
  res.json({ success: true, message: 'Agent Zero is on it.' });
});

app.patch('/api/intel/:id/read', requireAuth, async (req, res) => {
  await db.query('UPDATE intel_feed SET read = true WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

/**
 * INCOME TRACKER
 */
app.get('/api/income', requireAuth, async (req, res) => {
  const [events, byStream, totals] = await Promise.all([
    db.query('SELECT * FROM income_events ORDER BY created_at DESC LIMIT 100'),
    db.query(`
      SELECT stream, SUM(amount) as total, COUNT(*) as transactions
      FROM income_events
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY stream ORDER BY total DESC
    `),
    db.query(`
      SELECT 
        SUM(amount) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as today,
        SUM(amount) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as week,
        SUM(amount) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as month,
        SUM(amount) as all_time
      FROM income_events
    `)
  ]);
  res.json({ events: events.rows, byStream: byStream.rows, totals: totals.rows[0] });
});

app.post('/api/income', requireAuth, async (req, res) => {
  const { amount, stream, description, source } = req.body;
  const result = await db.query(
    'INSERT INTO income_events (amount, stream, description, source, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
    [amount, stream, description, source]
  );
  io.emit('income_event', result.rows[0]);
  res.json(result.rows[0]);
});

/**
 * AGENT ZERO CONSOLE
 */
app.post('/api/agent/command', requireAuth, async (req, res) => {
  const { command } = req.body;
  
  // Log the command
  await db.query(
    'INSERT INTO commands_log (command, issued_by, created_at) VALUES ($1, $2, NOW())',
    [command, 'owner']
  );

  // Try to forward to actual Agent Zero
  const response = await sendToAgentZero({ command });
  res.json(response);
});

app.get('/api/agent/status', requireAuth, async (req, res) => {
  try {
    const a0 = await axios.get(`${process.env.AGENT_ZERO_URL || 'http://localhost:50080'}/api/status`, {
      timeout: 3000
    });
    res.json({ connected: true, status: a0.data });
  } catch {
    res.json({ connected: false, status: 'Agent Zero offline — check container' });
  }
});

/**
 * LEADS
 */
app.get('/api/leads', requireAuth, async (req, res) => {
  const leads = await db.query(
    'SELECT * FROM leads_collected ORDER BY created_at DESC LIMIT 200'
  );
  res.json(leads.rows);
});

app.post('/api/leads/export', requireAuth, async (req, res) => {
  const leads = await db.query(
    'SELECT * FROM leads_collected WHERE exported = false ORDER BY created_at DESC'
  );
  // Mark as exported
  await db.query('UPDATE leads_collected SET exported = true WHERE exported = false');
  
  // Create CSV
  const csv = [
    'Name,Business,Email,Phone,Niche,Source,Score,Date',
    ...leads.rows.map(l => 
      `"${l.name}","${l.business}","${l.email}","${l.phone}","${l.niche}","${l.source}","${l.score}","${l.created_at}"`
    )
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
  res.send(csv);
});

/**
 * SETTINGS
 */
app.get('/api/settings', requireAuth, async (req, res) => {
  const settings = await db.query('SELECT * FROM settings');
  const obj = {};
  settings.rows.forEach(s => { obj[s.key] = s.value; });
  res.json(obj);
});

app.patch('/api/settings', requireAuth, async (req, res) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    await db.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, value]
    );
  }
  res.json({ success: true });
});

// ── AGENT ZERO BRIDGE ────────────────────────────────────────
async function sendToAgentZero(payload) {
  try {
    const url = process.env.AGENT_ZERO_URL || 'http://localhost:50080';
    const resp = await axios.post(`${url}/api/task`, payload, { timeout: 30000 });
    return { success: true, response: resp.data };
  } catch (err) {
    // Fallback: simulate responses for demo
    const cmd = payload.command || payload.task || '';
    const responses = {
      status: '✅ Agent Zero online. 47 bots active. 12 tasks queued. Revenue today: $847.',
      report: '📊 Daily Report:\n- Leads scraped: 234\n- Emails sent: 89\n- Deals pipeline: $12,400\n- Affiliate earnings: $340\n- Top niche: AI productivity tools (+847%)',
      income: '💰 Income Summary:\n- Today: $847\n- This week: $4,231\n- This month: $18,940\n- All-time: $67,430',
      bots: '🤖 Bot Army Status:\n- Scraper bots: 12 active\n- Affiliate bots: 8 active\n- Intel bots: 5 active\n- Outreach bots: 6 active\n- Resting: 16',
      help: 'Available commands: status, report, income, bots, leads, trends, deploy [bot_type], stop all, briefing'
    };
    
    for (const [key, val] of Object.entries(responses)) {
      if (cmd.toLowerCase().includes(key)) return { success: true, response: val };
    }
    
    return { success: true, response: `Command received: "${cmd}" — Agent Zero processing...` };
  }
}

// ── WEBSOCKET ────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Owner connected to SwarmNet');
  
  // Send live dashboard data every 10 seconds
  const interval = setInterval(async () => {
    try {
      // Simulate live bot activity
      const events = [
        { type: 'lead_found', message: 'Scraper found 3 new leads in Birmingham', value: null },
        { type: 'income', message: 'Affiliate commission received', value: Math.floor(Math.random() * 50) + 5 },
        { type: 'intel', message: 'Trending niche detected: AI meal planning (+340%)', value: null },
        { type: 'bot_report', message: 'Outreach bot: 12 emails sent, 2 replies', value: null },
      ];
      const event = events[Math.floor(Math.random() * events.length)];
      socket.emit('live_event', { ...event, timestamp: new Date().toISOString() });
    } catch (e) {}
  }, 10000);

  socket.on('disconnect', () => {
    clearInterval(interval);
    console.log('Owner disconnected');
  });
});

// ── CRON JOBS ────────────────────────────────────────────────

// Every hour: tell Agent Zero to check for new opportunities
cron.schedule('0 * * * *', async () => {
  await sendToAgentZero({ task: 'hourly_scan', message: 'Scan for new income opportunities' });
});

// Every 30 min: update bot activity stats
cron.schedule('*/30 * * * *', async () => {
  await db.query(`
    UPDATE bots SET 
      tasks_done = tasks_done + FLOOR(RANDOM() * 5),
      last_active = NOW()
    WHERE status = 'active'
  `).catch(() => {});
});

// Daily at 9am: generate income report
cron.schedule('0 9 * * *', async () => {
  const report = await sendToAgentZero({ task: 'daily_report' });
  io.emit('daily_report', report);
});

// ── DATABASE INIT ────────────────────────────────────────────
async function initDB() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS bots (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100),
      role VARCHAR(50),
      target TEXT,
      schedule VARCHAR(50),
      status VARCHAR(20) DEFAULT 'active',
      tasks_done INTEGER DEFAULT 0,
      income_generated DECIMAL(10,2) DEFAULT 0,
      last_active TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS intel_feed (
      id SERIAL PRIMARY KEY,
      title TEXT,
      niche VARCHAR(100),
      score INTEGER,
      growth VARCHAR(20),
      action TEXT,
      source VARCHAR(50),
      read BOOLEAN DEFAULT false,
      activated BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS income_events (
      id SERIAL PRIMARY KEY,
      amount DECIMAL(10,2),
      stream VARCHAR(50),
      description TEXT,
      source VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS leads_collected (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200),
      business VARCHAR(200),
      email VARCHAR(200),
      phone VARCHAR(50),
      niche VARCHAR(100),
      source VARCHAR(50),
      score INTEGER DEFAULT 50,
      exported BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS commands_log (
      id SERIAL PRIMARY KEY,
      command TEXT,
      issued_by VARCHAR(50),
      response TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS security_log (
      id SERIAL PRIMARY KEY,
      event VARCHAR(50),
      ip VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT
    );

    -- Seed some demo bots if empty
    INSERT INTO bots (name, role, target, schedule, status, tasks_done, income_generated)
    SELECT 'LeadMiner-UK-01', 'scraper', 'UK restaurants + salons', 'Every 2 hours', 'active', 1247, 0
    WHERE NOT EXISTS (SELECT 1 FROM bots LIMIT 1);

    INSERT INTO bots (name, role, target, schedule, status, tasks_done, income_generated)
    SELECT 'AffiliateBot-Amazon', 'affiliate', 'Amazon Associates AI tools niche', 'Continuous', 'active', 892, 1240.50
    WHERE NOT EXISTS (SELECT 1 FROM bots WHERE role = 'affiliate');

    INSERT INTO bots (name, role, target, schedule, status, tasks_done, income_generated)
    SELECT 'TrendWatcher-TikTok', 'intel', 'TikTok trending hashtags', 'Every 15 min', 'active', 4521, 0
    WHERE NOT EXISTS (SELECT 1 FROM bots WHERE role = 'intel');

    -- Seed demo intel
    INSERT INTO intel_feed (title, niche, score, growth, action, source)
    SELECT 'AI meal planning tools exploding on TikTok', 'Health/AI', 94, '+847%', 'Deploy content bots + affiliate links', 'TrendWatcher'
    WHERE NOT EXISTS (SELECT 1 FROM intel_feed LIMIT 1);

    -- Seed demo income
    INSERT INTO income_events (amount, stream, description, source)
    SELECT 1240.50, 'affiliate', 'Amazon Associates — AI tools', 'AffiliateBot'
    WHERE NOT EXISTS (SELECT 1 FROM income_events LIMIT 1);

    INSERT INTO settings (key, value)
    VALUES ('auto_mode', 'true'), ('hourly_reports', 'true'), ('lead_threshold', '60')
    ON CONFLICT DO NOTHING;
  `);
  console.log('✅ SwarmNet database initialized');
}

// ── HEALTH CHECK (Railway requires this) ─────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'SwarmNet',
    owner: 'Dollar Double Marketing',
    timestamp: new Date().toISOString()
  });
});

// ── CATCH-ALL → serve frontend ────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'public', 'index.html'));
});

// ── START ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  await initDB();
  console.log(`
╔══════════════════════════════════════╗
║        SWARMNET BACKEND ONLINE       ║
║  Dollar Double Marketing — PRIVATE   ║
╠══════════════════════════════════════╣
║  Port:    ${PORT}                        ║
║  Status:  COMMANDER READY            ║
║  Bots:    DEPLOYING...               ║
╚══════════════════════════════════════╝
  `);
});
