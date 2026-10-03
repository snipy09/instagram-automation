
import axios from 'axios';
import { config } from '../config';
import { Logger } from '../utils/logger';

/**
 * Universal AI client — supports OpenClaw, OpenAI, Gemini, OpenRouter,
 * or any OpenAI-compatible endpoint. Just set the provider in .env.
 */

const providerEndpoints: Record<string, string> = {
    // OpenClaw's local Gateway exposes an OpenAI-compatible endpoint.
    openclaw: `${process.env.OPENCLAW_BASE_URL || 'http://127.0.0.1:18789/v1'}/chat/completions`,
    openai: 'https://api.openai.com/v1/chat/completions',
    openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    ollama: 'http://localhost:11434/v1/chat/completions',
};

export class AIBrain {
    private endpoint: string;
    private model: string;
    private apiKey: string;
    private tone: string;

    constructor() {
        const provider = config.ai.provider.toLowerCase();
        this.endpoint = providerEndpoints[provider]
            || providerEndpoints['openclaw']; // Default to OpenClaw
        this.model = config.ai.model;
        this.apiKey = config.ai.apiKey;
        this.tone = config.ai.tone;
    }

    /**
     * Generate a contextual, human-sounding comment for a post.
     * @param postCaption - The text caption of the Instagram post.
     * @param username    - Person who posted it.
     */
    async generateComment(postCaption: string, username: string): Promise<string> {
        const systemPrompt = `${this.tone}
        
Rules:
1. Never say "nice post", "great content", "amazing photo" — be SPECIFIC about what's in the post.
2. Max 10 words. No hashtags. At most 1 emoji.
3. Sound like a real person scrolling, not a brand.
4. If there's no caption, say something short and friendly about the image.
5. Never repeat the same comment twice.`;

        const userPrompt = `Post by @${username}: "${postCaption || '(no caption — reply about the vibe/image)'}"

Generate a single short, natural-sounding Instagram comment.`;

        return this.callLLM(systemPrompt, userPrompt);
    }


    /**
     * Relevancy check to ensure we only interact with potential leads or peers.
     */
    async isPostRelevant(postCaption: string, username: string): Promise<boolean> {
        if (!config.filtering.strictRelevance) return true;
        if (!config.targeting.accountContext) return true;

        const systemPrompt = `You are a strict filtering AI for an Instagram account.
Account Context: "${config.targeting.accountContext}"

Analyze the post. Is it relevant to this account (e.g., a potential client, a lead, a peer in the exact same niche, or relevant industry news)?
If it is unrelated to the account's niche, personal noise, or random spam, reject it.
Respond ONLY with the word YES or NO.`;

        const userPrompt = `Post by @${username}: "${postCaption || '(no caption)'}"`;

        const response = await this.callLLM(systemPrompt, userPrompt);
        return response.toUpperCase().includes('YES');
    }

    /**
     * Generate a contextual DM reply.
     */
    async generateDMReply(incomingMessage: string, senderName: string): Promise<string> {
        const systemPrompt = `${this.tone}
        
You are replying to an Instagram DM. Keep it warm, casual, human. Max 2 sentences.
Never make up facts. If you don't know something, say "let me get back to you on that!"
Don't oversell. Don't use formal language.`;

        const userPrompt = `DM from @${senderName}: "${incomingMessage}"

Write a natural DM reply.`;

        return this.callLLM(systemPrompt, userPrompt);
    }

    private async callLLM(system: string, user: string): Promise<string> {
        if (config.ai.provider === 'none') {
            return this.getFallbackComment();
        }

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            
            if (config.ai.provider === 'gemini') {
                // Gemini uses x-goog-api-key
                headers['x-goog-api-key'] = this.apiKey;
            } else {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }

            const resp = await axios.post(
                this.endpoint,
                {
                    model: this.model,
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: user }
                    ],
                    max_tokens: 60,
                    temperature: 0.85
                },
                { headers, timeout: 45_000 }
            );

            const text = resp.data?.choices?.[0]?.message?.content?.trim();
            if (!text) return this.getFallbackComment();

            // Strip wrapping quotes from LLM output if present
            return text.replace(/^["']|["']$/g, '');
        } catch (err: any) {
            Logger.error(`AI request failed: ${err.message}`);
            return this.getFallbackComment();
        }
    }

    private getFallbackComment(): string {
        const templates = [
            "the bug had other plans",
            "this is what shipping through chaos looks like",
            "production feared this energy",
            "somewhere a server is smiling",
            "debugging but make it cinematic",
            "the tiny details did the heavy lifting here",
            "you can feel the iterations",
            "cleaner than my commit history",
            "this sprint actually had character development",
            "ship it before the chai gets cold",
            "the plot twist was in production",
            "looks suspiciously well tested",
            "this actually works on my machine too",
            "giving hard earned dopamine",
            "woke up and chose clean architecture"
        ];
        return templates[Math.floor(Math.random() * templates.length)];
    }
}
