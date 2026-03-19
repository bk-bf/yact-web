export interface CryptoHeadline {
    id: string;
    title: string;
    url: string;
    source: string;
    publishedAt: string;
}

interface RedditPost {
    id: string;
    title: string;
    permalink: string;
    url: string;
    subreddit: string;
    created_utc: number;
    score: number;
    over_18: boolean;
    stickied: boolean;
}

interface RedditChild {
    data: RedditPost;
}

interface RedditListing {
    data: {
        children: RedditChild[];
    };
}

const REDDIT_ENDPOINTS = [
    'https://www.reddit.com/r/CryptoCurrency/hot.json?limit=25',
    'https://www.reddit.com/r/Bitcoin/hot.json?limit=25'
] as const;

const RSS_ENDPOINTS = [
    'https://www.coindesk.com/arc/outboundfeeds/rss/',
    'https://cointelegraph.com/rss'
] as const;

const REDDIT_HEADERS = {
    accept: 'application/json',
    'user-agent': 'yact/1.0 (crypto-headlines)'
};

function sanitizeTitle(title: string): string {
    return title.replace(/\s+/g, ' ').trim();
}

function toHeadline(post: RedditPost): CryptoHeadline {
    return {
        id: post.id,
        title: sanitizeTitle(post.title),
        url: post.url?.startsWith('http') ? post.url : `https://www.reddit.com${post.permalink}`,
        source: `Reddit r/${post.subreddit}`,
        publishedAt: new Date(post.created_utc * 1000).toISOString()
    };
}

function isQualityPost(post: RedditPost): boolean {
    const title = sanitizeTitle(post.title).toLowerCase();
    if (!title || title.length < 20) {
        return false;
    }

    if (post.over_18 || post.stickied) {
        return false;
    }

    if (title.includes('daily discussion') || title.includes('daily crypto discussion')) {
        return false;
    }

    if (post.score < 25) {
        return false;
    }

    const url = post.url.toLowerCase();
    if (
        url.includes('reddit.com') ||
        url.includes('redd.it') ||
        url.includes('i.redd.it') ||
        url.includes('v.redd.it')
    ) {
        return false;
    }

    return true;
}

function sanitizeRssText(value: string): string {
    return value
        .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseRssHeadlines(xml: string, sourceLabel: string): CryptoHeadline[] {
    const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
    const parsed: CryptoHeadline[] = [];

    for (const item of items) {
        const title = item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '';
        const link = item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? '';
        const guid = item.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ?? link;
        const publishedAtRaw = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? '';

        const normalizedTitle = sanitizeRssText(title);
        const normalizedLink = sanitizeRssText(link);
        const normalizedGuid = sanitizeRssText(guid);
        const publishedAtDate = new Date(sanitizeRssText(publishedAtRaw));

        if (!normalizedTitle || !normalizedLink.startsWith('http')) {
            continue;
        }

        parsed.push({
            id: normalizedGuid || normalizedLink,
            title: normalizedTitle,
            url: normalizedLink,
            source: sourceLabel,
            publishedAt: Number.isNaN(publishedAtDate.getTime())
                ? new Date().toISOString()
                : publishedAtDate.toISOString()
        });
    }

    return parsed;
}

async function getRssHeadlines(fetchFn: typeof fetch, limit: number): Promise<CryptoHeadline[]> {
    const responses = await Promise.allSettled(
        RSS_ENDPOINTS.map(async (endpoint) => {
            const response = await fetchFn(endpoint, {
                headers: {
                    accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
                    'user-agent': 'yact/1.0 (crypto-headlines-rss)'
                }
            });

            if (!response.ok) {
                throw new Error(`RSS headlines request failed with status ${response.status}`);
            }

            return response.text();
        })
    );

    const merged = responses
        .flatMap((result, index) => {
            if (result.status !== 'fulfilled') {
                return [];
            }

            const source = RSS_ENDPOINTS[index].includes('coindesk')
                ? 'CoinDesk RSS'
                : 'Cointelegraph RSS';
            return parseRssHeadlines(result.value, source);
        })
        .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));

    const seen = new Set<string>();
    const deduped = merged.filter((headline) => {
        const key = sanitizeTitle(headline.title).toLowerCase();
        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });

    return deduped.slice(0, limit);
}

export async function getTopCryptoHeadlines(fetchFn: typeof fetch, limit = 5): Promise<CryptoHeadline[]> {
    const target = Math.max(3, Math.min(limit, 5));

    const results = await Promise.allSettled(
        REDDIT_ENDPOINTS.map(async (endpoint) => {
            const response = await fetchFn(endpoint, { headers: REDDIT_HEADERS });
            if (!response.ok) {
                throw new Error(`Crypto headlines request failed with status ${response.status}`);
            }

            const payload = (await response.json()) as RedditListing;
            return payload.data.children.map((child) => child.data);
        })
    );

    const merged = results
        .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
        .filter(isQualityPost)
        .sort((a, b) => b.score - a.score);

    const seen = new Set<string>();
    const deduped = merged.filter((post) => {
        const key = sanitizeTitle(post.title).toLowerCase();
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });

    const redditHeadlines = deduped.slice(0, target).map(toHeadline);
    if (redditHeadlines.length >= target) {
        return redditHeadlines;
    }

    const rssHeadlines = await getRssHeadlines(fetchFn, target);
    if (!rssHeadlines.length) {
        return redditHeadlines;
    }

    const combined = [...redditHeadlines, ...rssHeadlines];
    const seenHeadline = new Set<string>();
    const finalHeadlines = combined.filter((headline) => {
        const key = sanitizeTitle(headline.title).toLowerCase();
        if (seenHeadline.has(key)) {
            return false;
        }

        seenHeadline.add(key);
        return true;
    });

    return finalHeadlines.slice(0, target);
}

export function getFallbackCryptoHeadlines(): CryptoHeadline[] {
    return [];
}
