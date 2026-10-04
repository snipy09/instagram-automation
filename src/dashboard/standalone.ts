import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { config, profiles } from '../config';
import { Storage } from '../utils/storage';

const app = express();
app.use(cors());
const publicDir = fs.existsSync(path.join(__dirname, 'public'))
    ? path.join(__dirname, 'public')
    : path.join(__dirname, '../../src/dashboard/public');

app.use(express.static(publicDir));
app.use(express.json());

// API: Get Live Settings & Stats
app.get('/api/status', (req, res) => {
    const activeLimits = profiles[config.safety.profile as keyof typeof profiles];
    const stats = Storage.getStats();

    res.json({
        config: {
            profile: config.safety.profile,
            ai_provider: config.ai.provider,
            ai_model: config.ai.model,
            hashtags: config.targeting.hashtags
        },
        limits: activeLimits,
        stats: {
            likesToday: stats.likesToday,
            commentsToday: stats.commentsToday,
            dMsToday: stats.dMsToday,
        }
    });
});

// API: Get Logs
app.get('/api/logs', (req, res) => {
    try {
        if (!fs.existsSync(config.paths.logsFile)) {
            return res.json({ logs: [] });
        }
        const data = fs.readFileSync(config.paths.logsFile, 'utf8');
        const lines = data.split('\n').filter(l => l.trim().length > 0).slice(-50); // Get last 50 lines
        res.json({ logs: lines });
    } catch(e) {
        res.json({ logs: [] });
    }
});

const PORT = config.dashboard.port || 3456;
app.listen(PORT, () => {
    console.log(chalk.green(`
=========================================
🌐 INSTAGRAM AUTOPILOT DASHBOARD RUNNING 
=========================================
URL: http://localhost:${PORT}

Press CTRL+C anytime to close the dashboard server.
(This does not stop the background bot!)
`));
});
