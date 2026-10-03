import { chromium } from 'playwright-extra';
import type { BrowserContext, Page } from 'playwright';
// @ts-ignore
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { config } from '../config';
import { Logger } from '../utils/logger';
import fs from 'fs';

// Apply the stealth plugin to avoid detection
chromium.use(stealthPlugin());

export class BrowserEngine {
    private context: BrowserContext | null = null;
    public page: Page | null = null;

    async launch(headless: boolean = true): Promise<Page> {
        try {
            // Ensure profile dir exists
            if (!fs.existsSync(config.paths.userDataDir)) {
                fs.mkdirSync(config.paths.userDataDir, { recursive: true });
            }

            Logger.info('Launching AI Browser Engine...');
            
            // Launch persistent context so cookies & sessions remain
            this.context = await chromium.launchPersistentContext(config.paths.userDataDir, {
                headless,
                viewport: { width: 1280, height: 800 },
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-infobars',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--no-sandbox',
                    '--window-size=1280,800',
                ],
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });

            // Set stealth Init scripts
            await this.context.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                (globalThis as any).window = (globalThis as any).window || {};
                (globalThis as any).window.chrome = { runtime: {}, app: {}, loadTimes: () => ({}) };
            });

            // If auth.json exists and context has no sessionid, import cookies
            if (fs.existsSync(config.paths.authFile)) {
                try {
                    const raw = fs.readFileSync(config.paths.authFile, 'utf8');
                    const state = JSON.parse(raw);
                    if (Array.isArray(state.cookies) && state.cookies.length > 0) {
                        await this.context.addCookies(state.cookies);
                    }
                } catch (_) {}
            }

            const pages = this.context.pages();
            this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
            
            return this.page;
        } catch (err: any) {
            Logger.error(`Browser launch failed: ${err.message}`);
            throw err;
        }
    }

    async stop() {
        if (this.context) {
            Logger.info('Closing Browser context securely...');
            try {
                // Save state to auth.json before closing
                if (this.context) {
                    await this.context.storageState({ path: config.paths.authFile });
                }
            } catch (_) {}
            await this.context.close();
            this.context = null;
        }
    }
}
