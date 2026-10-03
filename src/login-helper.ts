import { BrowserEngine } from './engine/browser';
import { Logger } from './utils/logger';
import { config } from './config';
import fs from 'fs';

async function runLogin() {
    Logger.info('Starting Login Helper...');
    Logger.info('A visible Chrome window will now open.');
    Logger.info('Please log in with your Instagram username and password.');
    Logger.info('If Instagram asks for 2FA or SMS verification, enter it in the browser.');
    Logger.info('The script will automatically detect your login and save the session.');

    const engine = new BrowserEngine();
    const page = await engine.launch(false); // HEADLESS = false

    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded' });

    let isSaved = false;

    // Check periodically for valid session cookies
    const checkInterval = setInterval(async () => {
        try {
            if (!page || page.isClosed()) {
                clearInterval(checkInterval);
                return;
            }

            const cookies = await page.context().cookies('https://www.instagram.com');
            const hasSession = cookies.some(c => c.name === 'sessionid' && c.value.length > 5);

            if (hasSession && !isSaved) {
                isSaved = true;
                clearInterval(checkInterval);

                // Give page a moment to settle onto feed
                await page.waitForTimeout(3000);

                // Extract username
                let username = 'user';
                try {
                    username = await page.evaluate(() => {
                        // Look for profile avatar alt text e.g. "username's profile picture"
                        const img = document.querySelector('img[alt*="profile picture" i]');
                        if (img) {
                            const alt = img.getAttribute('alt') || '';
                            const match = alt.match(/^(.+?)'s profile picture/i);
                            if (match && match[1]) return match[1];
                        }
                        // Look for sidebar links
                        const links = Array.from(document.querySelectorAll('a[role="link"], nav a'));
                        for (const a of links) {
                            const href = a.getAttribute('href') || '';
                            if (href.startsWith('/') && !href.includes('/explore') && !href.includes('/reels') && !href.includes('/direct') && !href.includes('/stories') && !href.includes('/accounts') && href.length > 2) {
                                const clean = href.replace(/\//g, '');
                                if (clean && !clean.includes('?')) return clean;
                            }
                        }
                        return '';
                    }) || '';
                } catch (_) {}

                // Save storage state file as backup
                try {
                    fs.mkdirSync(config.paths.dataDir, { recursive: true });
                    await page.context().storageState({ path: config.paths.authFile });
                } catch (_) {}

                Logger.success(`Successfully logged in as @${username || 'your_account'}!`);
                Logger.success('Session saved to data/browser_profile and data/auth.json.');
                Logger.info('Closing browser in 3 seconds. You are now ready to run 3-Start-Bot.bat.');

                setTimeout(async () => {
                    await engine.stop();
                    process.exit(0);
                }, 3000);
            }
        } catch (_) {}
    }, 1500);

    page.on('close', async () => {
        clearInterval(checkInterval);
        if (!isSaved) {
            Logger.warn('Browser was closed before Instagram login was completed.');
            Logger.warn('Please re-run 2-Login.bat and complete login to save your session.');
            await engine.stop();
            process.exit(1);
        }
    });
}

runLogin().catch(async (e) => {
    Logger.error('Login helper encountered an error: ' + e.message);
    process.exit(1);
});
