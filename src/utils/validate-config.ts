import fs from 'fs';
import path from 'path';
import { config, profiles, getActiveLimits } from '../config';

export interface ValidationReport {
    valid: boolean;
    errors: string[];
    warnings: string[];
    summary: {
        safetyProfile: string;
        aiProvider: string;
        targetingHashtags: string[];
        limits: ReturnType<typeof getActiveLimits>;
        paths: Record<string, string>;
    };
}

export function validateConfiguration(): ValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate Safety Profile
    if (!profiles[config.safety.profile as keyof typeof profiles]) {
        errors.push(`Invalid safety profile "${config.safety.profile}". Expected one of: ${Object.keys(profiles).join(', ')}`);
    }

    // Validate Sleep Hours
    if (config.safety.sleepStart < 0 || config.safety.sleepStart > 23) {
        errors.push(`Invalid sleepStart hour: ${config.safety.sleepStart}. Must be 0-23.`);
    }
    if (config.safety.sleepEnd < 0 || config.safety.sleepEnd > 23) {
        errors.push(`Invalid sleepEnd hour: ${config.safety.sleepEnd}. Must be 0-23.`);
    }

    // Validate Targeting
    if (!config.targeting.hashtags || config.targeting.hashtags.length === 0 || (config.targeting.hashtags.length === 1 && !config.targeting.hashtags[0])) {
        warnings.push('No target hashtags configured. Defaulting to general discover tags.');
    }

    // Validate AI Provider Settings
    const validAiProviders = ['openclaw', 'openai', 'gemini', 'openrouter', 'none'];
    if (!validAiProviders.includes(config.ai.provider.toLowerCase())) {
        errors.push(`Invalid AI provider "${config.ai.provider}". Expected one of: ${validAiProviders.join(', ')}`);
    }

    if (config.ai.provider !== 'none' && !config.ai.apiKey && !process.env.OPENCLAW_API_KEY && !process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
        warnings.push(`AI provider "${config.ai.provider}" is active, but no API key was detected in environment variables.`);
    }

    // Check Data Directories
    try {
        if (!fs.existsSync(config.paths.dataDir)) {
            fs.mkdirSync(config.paths.dataDir, { recursive: true });
        }
    } catch (err: any) {
        errors.push(`Failed to ensure data directory at ${config.paths.dataDir}: ${err.message}`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        summary: {
            safetyProfile: config.safety.profile,
            aiProvider: config.ai.provider,
            targetingHashtags: config.targeting.hashtags,
            limits: getActiveLimits(),
            paths: {
                dataDir: config.paths.dataDir,
                userDataDir: config.paths.userDataDir,
                statsFile: config.paths.statsFile,
                authFile: config.paths.authFile,
                logsFile: config.paths.logsFile
            }
        }
    };
}

if (require.main === module) {
    console.log('=== Instagram Automation Configuration Validator ===');
    const result = validateConfiguration();

    console.log(`Safety Profile: ${result.summary.safetyProfile.toUpperCase()}`);
    console.log(`AI Provider:    ${result.summary.aiProvider}`);
    console.log(`Target Tags:    ${result.summary.targetingHashtags.join(', ') || '(none)'}`);
    console.log(`Daily Limits:   ${result.summary.limits.dailyLikes} likes | ${result.summary.limits.dailyComments} comments | ${result.summary.limits.dailyDMs} DMs`);
    console.log('-'.repeat(52));

    if (result.warnings.length > 0) {
        console.log('Warnings:');
        result.warnings.forEach(w => console.log(` [!] ${w}`));
    }

    if (result.errors.length > 0) {
        console.log('Errors:');
        result.errors.forEach(e => console.log(` [x] ${e}`));
        console.log('\n[FAILED] Configuration validation failed.');
        process.exit(1);
    } else {
        console.log('[OK] All configuration schemas and runtime parameters valid.');
        process.exit(0);
    }
}
