import { BrowserEngine } from './engine/browser';
import { AIBrain } from './ai/brain';
import { Logger } from './utils/logger';
import { config, getActiveLimits } from './config';
import { Storage } from './utils/storage';
import { Humanizer } from './engine/humanizer';

class AutoPilotDaemon {
    private engine: BrowserEngine;
    private brain: AIBrain;
    private isRunning: boolean = true;
    /** Post hrefs we have already touched this session to avoid repeats. */
    private seenPosts: Set<string> = new Set();

    constructor() {
        this.engine = new BrowserEngine();
        this.brain = new AIBrain();
    }

    private sleepUntilMorning(): boolean {
        const now = new Date();
        const start = config.safety.sleepStart;
        const end   = config.safety.sleepEnd;
        if (start > end) {
            return now.getHours() >= start || now.getHours() < end;
        }
        return now.getHours() >= start && now.getHours() < end;
    }

    async start() {
        Logger.info('Initializing Instagram AutoPilot AI Daemon...');
        Logger.info(`Configured AI: ${config.ai.provider} | Model: ${config.ai.model}`);
        Logger.info(`Target Hashtags: [${config.targeting.hashtags.join(', ')}]`);

        const page = await this.engine.launch(true); // headless background

        // ── Real login check ──────────────────────────────────────────────────
        // We check the saved profile is actually authenticated. If the username
        // login field appears, it means the session cookies have expired or were
        // never saved — force stop and ask the user to re-run 2-Login.bat.
        await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle' });
        await Humanizer.randomPause(2, 4);

        const loginInput = await page.$('input[name="username"]');
        if (loginInput) {
            Logger.error('Session expired or not logged in. Close this window, run 2-Login.bat, log in manually, then restart the bot.');
            process.exit(1);
        }

        // Confirm we're on the real feed, not a soft redirect
        const feedConfirm = await page.$('svg[aria-label="Home"], nav, main[role="main"]');
        if (!feedConfirm) {
            Logger.warn('Could not confirm Feed is visible — proceeding cautiously.');
        }

        // ── Show logged-in account username ───────────────────────────────
        let accountName = 'unknown';
        try {
            // Instagram exposes the viewer's username in its shared data object
            accountName = await page.evaluate(() => {
                // Method 1: __ig_viewer from embedded JSON
                try {
                    const sd = (window as any)._sharedData;
                    if (sd?.config?.viewer?.username) return sd.config.viewer.username;
                } catch (_) {}
                // Method 2: meta tag
                try {
                    const el = document.querySelector('meta[property="al:ios:url"]');
                    if (el) {
                        const m = el.getAttribute('content')?.match(/user\?username=([^&]+)/);
                        if (m) return m[1];
                    }
                } catch (_) {}
                return '';
            }) || '';

            if (!accountName) {
                // Method 3: visit the profile settings API
                const resp = await page.evaluate(async () => {
                    try {
                        const r = await fetch('/api/v1/accounts/edit/web_form_data/', { credentials: 'include' });
                        if (r.ok) { const j = await r.json(); return j?.form_data?.username || ''; }
                    } catch (_) {}
                    return '';
                });
                accountName = resp || 'unknown';
            }
        } catch (_) {}

        Logger.success(`Logged in as @${accountName} — starting automation loop...`);

        // ── Main loop ─────────────────────────────────────────────────────────
        while (this.isRunning) {
            try {
                if (this.sleepUntilMorning()) {
                    Logger.info('Sleep cycle active. Resuming at morning hours...');
                    await Humanizer.randomPause(1800, 3600);
                    continue;
                }

                const stats  = Storage.getStats();
                const limits = getActiveLimits();

                const allQuotasDone =
                    (!config.modules.hashtagLike    || stats.likesToday    >= limits.dailyLikes) &&
                    (!config.modules.hashtagComment || stats.commentsToday >= limits.dailyComments);

                if (allQuotasDone) {
                    Logger.info('Daily quotas reached. Waiting for reset...');
                    await Humanizer.randomPause(1800, 3600);
                    continue;
                }

                if (config.modules.hashtagLike || config.modules.hashtagComment) {
                    await this.exploreRandomHashtag(page);
                }

                await Humanizer.cooldownPause();
            } catch (err: any) {
                Logger.error(`Loop error: ${err.message}. Retrying in 60s...`);
                await Humanizer.randomPause(60, 120);
            }
        }
    }

    private async exploreRandomHashtag(page: any) {
        const hashtags = config.targeting.hashtags;
        const tag = hashtags[Math.floor(Math.random() * hashtags.length)];
        Logger.action('Explore', `Surfing hashtag #${tag}`);

        await page.goto(`https://www.instagram.com/explore/tags/${tag}/`, { waitUntil: 'domcontentloaded' });

        const postSelector = 'a[href^="/p/"], a[href^="/reel/"]';
        await page.waitForSelector(postSelector, { state: 'attached', timeout: 18_000 }).catch(() => null);
        await Humanizer.randomPause(2, 4);

        // ── Pick a post we haven't touched yet in this session ────────────────
        const allLinks = await page.$$(postSelector);
        if (allLinks.length === 0) {
            Logger.warn(`No posts found for hashtag #${tag}`);
            return;
        }

        // Resolve hrefs, skip already-seen ones
        const fresh: { el: any; href: string }[] = [];
        for (const el of allLinks) {
            const href: string = await el.getAttribute('href').catch(() => '');
            if (href && !this.seenPosts.has(href)) {
                fresh.push({ el, href });
                if (fresh.length >= 9) break; // cap the pool at 9 candidates
            }
        }

        if (fresh.length === 0) {
            Logger.warn(`All visible posts on #${tag} already visited — skipping.`);
            return;
        }

        const chosen = fresh[Math.floor(Math.random() * fresh.length)];
        this.seenPosts.add(chosen.href);

        // ── Open the post ─────────────────────────────────────────────────────
        await chosen.el.click();
        await Humanizer.randomPause(3, 6);

        // ── Scrape metadata ───────────────────────────────────────────────────
        let username = 'someone';
        let caption  = '';

        try {
            // Current Instagram modal: username lives in the dialog header
            username = await page.locator('[role="dialog"] a[role="link"] span, header a span').first().innerText({ timeout: 4000 });
        } catch (_) {}

        try {
            // Caption lives in an <h1> inside the dialog
            caption = await page.locator('[role="dialog"] h1, article h1').first().innerText({ timeout: 4000 });
        } catch (_) {}

        if (!username || username === 'someone') {
            // Fallback: parse username from the href we stored  (/p/<id>/ won't have it,
            // but /reel/<id>/liked_by/<user>/ sometimes does — use the header link instead)
            try {
                username = await page.locator('a[href*="instagram.com/"] span').first().innerText({ timeout: 2000 });
            } catch (_) {}
        }

        Logger.action('AI Reading', `Post by @${username}: "${caption.slice(0, 60)}..."`);

        // ── Relevance filter ──────────────────────────────────────────────────
        if (config.filtering.strictRelevance) {
            Logger.info('Checking post relevance...');
            const relevant = await this.brain.isPostRelevant(caption, username);
            if (!relevant) {
                Logger.warn(`Skipping @${username}: not relevant to account context.`);
                await page.keyboard.press('Escape');
                return;
            }
        }

        // Generate comment before acting so we don't waste the API call if like fails
        const generatedComment = await this.brain.generateComment(caption, username);

        const stats  = Storage.getStats();
        const limits = getActiveLimits();

        // ── Like ──────────────────────────────────────────────────────────────
        if (config.modules.hashtagLike && stats.likesToday < limits.dailyLikes) {
            try {
                // Instagram uses accessible SVG via aria-label on the button, not the SVG itself
                const likeBtn = page.locator(
                    'button[aria-label="Like"], ' +
                    '[role="dialog"] button:has(svg[aria-label="Like"]), ' +
                    'article button:has(svg[aria-label="Like"])'
                ).first();
                if ((await likeBtn.count()) > 0 && (await likeBtn.isVisible())) {
                    await likeBtn.click();
                    Storage.addLike();
                    Logger.success(`Liked post by @${username}`);
                    await Humanizer.randomPause(1, 2);
                } else {
                    Logger.warn(`Like button not found for @${username}`);
                }
            } catch (_) {}
        }

        // ── Comment ───────────────────────────────────────────────────────────
        if (config.modules.hashtagComment && stats.commentsToday < limits.dailyComments) {
            try {
                const commentBox = page.locator(
                    'textarea[placeholder*="comment" i], textarea[aria-label*="comment" i]'
                ).first();

                if ((await commentBox.count()) === 0 || !(await commentBox.isVisible())) {
                    Logger.warn('Comment box not visible; skipped.');
                } else {
                    Logger.info(`Typing comment: "${generatedComment}"`);
                    await commentBox.click();
                    await Humanizer.randomPause(0.2, 0.5);
                    await page.keyboard.type(generatedComment, { delay: Math.floor(Math.random() * 80) + 35 });
                    await Humanizer.randomPause(0.6, 1.4);

                    // The Post/Submit button activates only after text is entered
                    const postBtn = page.locator(
                        'button[type="submit"]:not([disabled]), ' +
                        'div[role="button"]:has-text("Post"), ' +
                        'button:has-text("Post")'
                    ).last();

                    if ((await postBtn.count()) > 0 && (await postBtn.isVisible())) {
                        await postBtn.click();
                        Storage.addComment(chosen.href);
                        Logger.success(`Commented on @${username}'s post!`);
                    } else {
                        // Clear the box - don't leave half-typed text
                        await page.keyboard.press('Control+a');
                        await page.keyboard.press('Delete');
                        Logger.warn('Post button not found after typing; comment cleared.');
                    }
                }
            } catch (e: any) {
                Logger.warn(`Comment error: ${e.message}`);
            }
        }

        await page.keyboard.press('Escape');
    }
}

const app = new AutoPilotDaemon();
app.start().catch((e) => {
    Logger.error('Fatal crash: ' + e);
    process.exit(1);
});
