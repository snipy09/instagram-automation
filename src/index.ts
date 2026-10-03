import { BrowserEngine } from './engine/browser';
import { AIBrain } from './ai/brain';
import { Logger } from './utils/logger';
import { config, getActiveLimits } from './config';
import { Storage } from './utils/storage';
import { Humanizer } from './engine/humanizer';
import path from 'path';

class AutoPilotDaemon {
    private engine: BrowserEngine;
    private brain: AIBrain;
    private isRunning: boolean = true;

    constructor() {
        this.engine = new BrowserEngine();
        this.brain = new AIBrain();
    }

    private sleepUntilMorning() {
        const now = new Date();
        const start = config.safety.sleepStart;
        const end = config.safety.sleepEnd;
        
        let shouldSleep = false;
        if (start > end) { // e.g. 23(11PM) to 8(8AM)
            if (now.getHours() >= start || now.getHours() < end) shouldSleep = true;
        } else {
            if (now.getHours() >= start && now.getHours() < end) shouldSleep = true;
        }
        return shouldSleep;
    }

    async start() {
        Logger.info('Initializing Instagram AutoPilot AI Daemon...');
        Logger.info(`Configured AI: ${config.ai.provider} | Model: ${config.ai.model}`);
        Logger.info(`Target Hashtags: [${config.targeting.hashtags.join(', ')}]`);
        
        const page = await this.engine.launch(true); // Headless for background

        // Ensure user is actually logged in before starting loops
        await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
        await Humanizer.randomPause(2, 5);

        const loginInput = await page.$('input[name="username"]');
        if (loginInput) {
            Logger.error('Account is NOT logged in. You must run the 2-Login.bat script FIRST before running the background daemon.');
            process.exit(1);
        }

        Logger.success('Session verified! Automatically surfing and engaging...');
        
        // --- MAIN BACKGROUND EVENT LOOP ---
        while (this.isRunning) {
            try {
                // 1. Check Sleep Cycle
                if (this.sleepUntilMorning()) {
                    Logger.info('Sleep rhythm active. Waiting for morning hours...');
                    await Humanizer.randomPause(1800, 3600); // Wait 30-60 mins before checking again
                    continue;
                }

                const stats = Storage.getStats();
                const limits = getActiveLimits();

                // 2. Explore Hashtags (if enabled and limit not reached)
                if (config.modules.hashtagLike && stats.likesToday < limits.dailyLikes) {
                    await this.exploreRandomHashtag(page);
                }

                // 3. Take a long safety cooldown between cycles
                await Humanizer.cooldownPause();
            } catch (err: any) {
                Logger.error(`Loop error: ${err.message}. Restarting loop in 60s...`);
                await Humanizer.randomPause(60, 120);
            }
        }
    }

    private async exploreRandomHashtag(page: any) {
        const hashtags = config.targeting.hashtags;
        const tag = hashtags[Math.floor(Math.random() * hashtags.length)];
        Logger.action('Explore', `Surfing hashtag #${tag}`);

        await page.goto(`https://www.instagram.com/explore/tags/${tag}/`, { waitUntil: 'domcontentloaded' });

        // Instagram's current grid does not consistently use an <article> wrapper.
        // Wait for a post link, then use broad post/reel URL selectors rather than
        // treating a slow client-side render as an empty hashtag page.
        const postSelector = 'a[href^="/p/"], a[href^="/reel/"]';
        await page.waitForSelector(postSelector, { state: 'attached', timeout: 15_000 }).catch(() => null);
        await Humanizer.randomPause(2, 4);

        const posts = await page.$$(postSelector);
        if (posts.length > 0) {
            // Click to open modal
            await posts[Math.floor(Math.random() * Math.min(3, posts.length))].click();
            await Humanizer.randomPause(3, 6);

            // Fetch post data
            let username = "someone";
            try {
                username = await page.locator('header span a').first().innerText();
            } catch (e) {}

            let caption = "";
            try {
                caption = await page.locator('h1').innerText();
            } catch (e) {}

            Logger.action('AI Reading', `Post by @${username}: "${caption.slice(0, 40)}..."`);
            
            // --- STRICT RELEVANCE AI CHECK ---
            if (config.filtering.strictRelevance) {
                Logger.info('Analyzing post relevance based on ACCOUNT_CONTEXT...');
                const isRelevant = await this.brain.isPostRelevant(caption, username);
                if (!isRelevant) {
                    Logger.warn(`Skipping post by @${username}: Not relevant to our business niche.`);
                    await page.keyboard.press('Escape');
                    return;
                }
                Logger.success('Post is relevant! Generating engagement...');
            }
            
            // Generate smart AI Comment
            const generatedComment = await this.brain.generateComment(caption, username);
            
            // Action decision based on quotas
            const stats = Storage.getStats();
            const limits = getActiveLimits();
            const postIdContext = `${tag}-${new Date().getTime()}`; // simplistic hashing for unique post

            if (config.modules.hashtagLike && stats.likesToday < limits.dailyLikes) {
                try {
                    // Try to click like button (if not already liked)
                    const likeSvg = await page.locator('svg[aria-label="Like"]').first();
                    if (likeSvg) {
                        await likeSvg.click();
                        Storage.addLike();
                        Logger.success(`Liked post by @${username}`);
                        await Humanizer.randomPause(1, 3);
                    }
                } catch(e) {}
            }

            if (config.modules.hashtagComment && stats.commentsToday < limits.dailyComments) {
                try {
                    // Instagram commonly renders the composer inside the post dialog.
                    // Check that a visible, enabled composer and its matching Post action
                    // actually exist before typing.
                    const commentBox = page.locator('[role="dialog"] textarea[aria-label*="comment" i], textarea[aria-label*="comment" i]').first();
                    const postButton = page.locator('[role="dialog"] button:has-text("Post"), [role="dialog"] div[role="button"]:has-text("Post"), button:has-text("Post")').first();

                    if (await commentBox.count() === 0 || !await commentBox.isVisible() || !await commentBox.isEnabled()) {
                        Logger.warn('Comment composer is unavailable; skipped comment without retrying.');
                    } else {
                        Logger.info(`AI drafted comment: "${generatedComment}"`);
                        await commentBox.click();
                        await page.keyboard.type(generatedComment, { delay: Math.floor(Math.random() * 80) + 45 });
                        await Humanizer.randomPause(0.5, 1.5);

                        if (await postButton.count() > 0 && await postButton.isVisible() && await postButton.isEnabled()) {
                            await postButton.click();
                            Storage.addComment(postIdContext);
                            Logger.success(`Commented on @${username}'s post!`);
                        } else {
                            Logger.warn('Comment drafted but the Post action is unavailable; skipped submission.');
                        }
                    }
                } catch(e) {
                     Logger.warn('Could not post comment. Composer changed or Instagram rejected the action.');
                }
            }

            // Close post modal (press escape)
            await page.keyboard.press('Escape');
        } else {
             Logger.warn(`No posts found for hashtag #${tag}`);
        }
    }
}

// Global entry point
const app = new AutoPilotDaemon();
app.start().catch((e) => {
    Logger.error('Fatal crash: ' + e);
    process.exit(1);
});
