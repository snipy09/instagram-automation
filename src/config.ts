
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

export const config = {
    ai: {
        provider: process.env.AI_PROVIDER || 'openclaw', // openclaw, openai, gemini, openrouter, none
        apiKey: process.env.AI_API_KEY || '',
        model: process.env.AI_MODEL_NAME || 'gpt-4o-mini',
        tone: process.env.AI_TONE_INSTRUCTION || 'Act as a friendly, supportive creator. Keep comments short (1-2 sentences), genuine.'
    },
    safety: {
        profile: process.env.SAFETY_PROFILE || 'balanced', // safe, balanced, active
        sleepStart: parseInt(process.env.SLEEP_START_HOUR || '23', 10),
        sleepEnd: parseInt(process.env.SLEEP_END_HOUR || '8', 10)
    },
    targeting: {
        hashtags: (process.env.TARGET_HASHTAGS || 'tech,coding,software').split(',').map(h => h.trim()),
        accountContext: process.env.ACCOUNT_CONTEXT || '',
    },
    filtering: {
        strictRelevance: process.env.STRICT_RELEVANCE_CHECK === 'true'
    },
    modules: {
        feedLike: process.env.ENABLE_AUTO_LIKE_FEED !== 'false',
        feedComment: process.env.ENABLE_AUTO_COMMENT_FEED === 'true',
        hashtagLike: process.env.ENABLE_AUTO_LIKE_HASHTAGS !== 'false',
        hashtagComment: process.env.ENABLE_AUTO_COMMENT_HASHTAGS === 'true',
        dmReply: process.env.ENABLE_DM_AUTO_REPLY === 'true'
    },
    dashboard: {
        port: parseInt(process.env.DASHBOARD_PORT || '3456', 10)
    },
    // Both src/config.ts (ts-node) and dist/config.js resolve one level
    // above their own directory to the project root.
    paths: {
        userDataDir: path.resolve(__dirname, '../data/browser_profile'),
        dataDir: path.resolve(__dirname, '../data'),
        statsFile: path.resolve(__dirname, '../data/stats.json'),
        logsFile: path.resolve(__dirname, '../data/app.log')
    }
};

export const profiles = {
    safe: {
        dailyLikes: 30, hourlyLikes: 8,
        dailyComments: 10, hourlyComments: 3,
        dailyDMs: 15, hourlyDMs: 4,
        jitterMinSec: 45, jitterMaxSec: 120
    },
    balanced: {
        dailyLikes: 70, hourlyLikes: 15,
        dailyComments: 25, hourlyComments: 6,
        dailyDMs: 30, hourlyDMs: 8,
        jitterMinSec: 30, jitterMaxSec: 90
    },
    active: {
        dailyLikes: 150, hourlyLikes: 25,
        dailyComments: 50, hourlyComments: 12,
        dailyDMs: 60, hourlyDMs: 15,
        jitterMinSec: 15, jitterMaxSec: 45
    }
};

export function getActiveLimits() {
    return profiles[config.safety.profile as keyof typeof profiles] || profiles.balanced;
}
