import type { MarketCoin } from '../types/market';

const COINGECKO_MARKETS_ENDPOINT =
    'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=24h';
const COINGECKO_GLOBAL_ENDPOINT = 'https://api.coingecko.com/api/v3/global';

const MARKET_CACHE_TTL_MS = 60_000;

const FALLBACK_BASE_COINS: Array<Pick<MarketCoin, 'id' | 'symbol' | 'name' | 'image'>> = [
    {
        id: 'bitcoin',
        symbol: 'btc',
        name: 'Bitcoin',
        image: 'https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?1696501400'
    },
    {
        id: 'ethereum',
        symbol: 'eth',
        name: 'Ethereum',
        image: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png?1696501628'
    },
    {
        id: 'tether',
        symbol: 'usdt',
        name: 'Tether',
        image: 'https://coin-images.coingecko.com/coins/images/325/large/Tether.png?1696501661'
    },
    {
        id: 'xrp',
        symbol: 'xrp',
        name: 'XRP',
        image: 'https://coin-images.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png?1696501442'
    },
    {
        id: 'binancecoin',
        symbol: 'bnb',
        name: 'BNB',
        image: 'https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png?1696501970'
    },
    {
        id: 'usd-coin',
        symbol: 'usdc',
        name: 'USDC',
        image: 'https://coin-images.coingecko.com/coins/images/6319/large/USDC.png?1769615602'
    },
    {
        id: 'solana',
        symbol: 'sol',
        name: 'Solana',
        image: 'https://coin-images.coingecko.com/coins/images/4128/large/solana.png?1718769756'
    },
    {
        id: 'tron',
        symbol: 'trx',
        name: 'TRON',
        image: 'https://coin-images.coingecko.com/coins/images/1094/large/tron-logo.png?1696502193'
    },
    {
        id: 'dogecoin',
        symbol: 'doge',
        name: 'Dogecoin',
        image: 'https://coin-images.coingecko.com/coins/images/5/large/dogecoin.png?1696501409'
    },
    {
        id: 'cardano',
        symbol: 'ada',
        name: 'Cardano',
        image: 'https://coin-images.coingecko.com/coins/images/975/large/cardano.png?1696502090'
    }
];

type MarketCache = {
    coins: MarketCoin[];
    fetchedAt: number;
};

export interface GlobalMarketSummary {
    totalMarketCapUsd: number;
    totalVolumeUsd: number;
    marketCapChangePercentage24hUsd: number;
    btcDominance: number;
    activeCryptocurrencies: number;
    marketCapSparkline7d: number[];
}

type GlobalCache = {
    summary: GlobalMarketSummary;
    fetchedAt: number;
};

let marketCache: MarketCache | null = null;
let globalCache: GlobalCache | null = null;

interface CoinGeckoMarketCoin {
    id: string;
    symbol: string;
    name: string;
    image: string;
    current_price: number;
    market_cap: number;
    total_volume: number;
    circulating_supply: number | null;
    market_cap_rank: number;
    price_change_percentage_24h: number | null;
    sparkline_in_7d?: {
        price: number[];
    };
}

interface CoinGeckoGlobalResponse {
    data: {
        total_market_cap: {
            usd: number;
        };
        total_volume: {
            usd: number;
        };
        market_cap_change_percentage_24h_usd: number;
        market_cap_percentage: {
            btc: number;
        };
        active_cryptocurrencies: number;
    };
}

function buildFallbackCoins(): MarketCoin[] {
    return Array.from({ length: 100 }, (_, i) => {
        const rank = i + 1;
        const base = FALLBACK_BASE_COINS[i] ?? {
            id: `token-${rank}`,
            symbol: `t${rank}`,
            name: `Token ${rank}`,
            image: 'https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png?1696501400'
        };

        return {
            ...base,
            currentPrice: 0,
            marketCap: 0,
            totalVolume24h: 0,
            circulatingSupply: 0,
            marketCapRank: rank,
            priceChangePercentage24h: 0,
            sparkline7d: [0, 0, 0, 0, 0, 0, 0]
        };
    });
}

const FALLBACK_COINS = buildFallbackCoins();

function normalizeCoin(coin: CoinGeckoMarketCoin): MarketCoin {
    const sparkline = coin.sparkline_in_7d?.price ?? [];

    return {
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        image: coin.image,
        currentPrice: coin.current_price,
        marketCap: coin.market_cap,
        totalVolume24h: coin.total_volume,
        circulatingSupply: coin.circulating_supply ?? 0,
        marketCapRank: coin.market_cap_rank,
        priceChangePercentage24h: coin.price_change_percentage_24h ?? 0,
        sparkline7d: sparkline.length > 1 ? sparkline : [coin.current_price, coin.current_price]
    };
}

function buildMarketCapSparkline(coins: MarketCoin[]): number[] {
    const withSparkline = coins.filter((coin) => coin.sparkline7d.length > 1 && coin.currentPrice > 0);

    if (!withSparkline.length) {
        return [0, 0, 0, 0, 0, 0, 0];
    }

    const points = Math.min(...withSparkline.map((coin) => coin.sparkline7d.length));
    const normalized: number[] = [];

    for (let i = 0; i < points; i += 1) {
        const cap = withSparkline.reduce((sum, coin) => {
            const ratio = coin.sparkline7d[i] / coin.currentPrice;
            return sum + coin.marketCap * ratio;
        }, 0);
        normalized.push(cap);
    }

    return normalized;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchMarketsWithRetry(fetchFn: typeof fetch): Promise<Response> {
    const first = await fetchFn(COINGECKO_MARKETS_ENDPOINT, {
        headers: {
            accept: 'application/json'
        }
    });

    if (first.status !== 429) {
        return first;
    }

    await sleep(1200);

    return fetchFn(COINGECKO_MARKETS_ENDPOINT, {
        headers: {
            accept: 'application/json'
        }
    });
}

async function fetchGlobalWithRetry(fetchFn: typeof fetch): Promise<Response> {
    const first = await fetchFn(COINGECKO_GLOBAL_ENDPOINT, {
        headers: {
            accept: 'application/json'
        }
    });

    if (first.status !== 429) {
        return first;
    }

    await sleep(1200);

    return fetchFn(COINGECKO_GLOBAL_ENDPOINT, {
        headers: {
            accept: 'application/json'
        }
    });
}

export function getCachedTopMarketCoins(): MarketCache | null {
    if (!marketCache) {
        return null;
    }

    const age = Date.now() - marketCache.fetchedAt;
    if (age > MARKET_CACHE_TTL_MS) {
        return null;
    }

    return marketCache;
}

export function getCachedGlobalMarketSummary(): GlobalCache | null {
    if (!globalCache) {
        return null;
    }

    const age = Date.now() - globalCache.fetchedAt;
    if (age > MARKET_CACHE_TTL_MS) {
        return null;
    }

    return globalCache;
}

export function getFallbackTopMarketCoins(): MarketCoin[] {
    return FALLBACK_COINS;
}

export function getFallbackGlobalMarketSummary(coins: MarketCoin[]): GlobalMarketSummary {
    const totalMarketCapUsd = coins.reduce((sum, coin) => sum + coin.marketCap, 0);
    const totalVolumeUsd = coins.reduce((sum, coin) => sum + coin.totalVolume24h, 0);
    const btc = coins.find((coin) => coin.symbol.toLowerCase() === 'btc');

    return {
        totalMarketCapUsd,
        totalVolumeUsd,
        marketCapChangePercentage24hUsd: 0,
        btcDominance: totalMarketCapUsd > 0 && btc ? (btc.marketCap / totalMarketCapUsd) * 100 : 0,
        activeCryptocurrencies: coins.length,
        marketCapSparkline7d: buildMarketCapSparkline(coins)
    };
}

export function getTopGainers(coins: MarketCoin[], count = 3): MarketCoin[] {
    return [...coins]
        .sort((a, b) => b.priceChangePercentage24h - a.priceChangePercentage24h)
        .slice(0, count);
}

export function getTrendingByVolume(coins: MarketCoin[], count = 3): MarketCoin[] {
    return [...coins]
        .sort((a, b) => b.totalVolume24h - a.totalVolume24h)
        .slice(0, count);
}

export async function getGlobalMarketSummary(fetchFn: typeof fetch): Promise<GlobalMarketSummary> {
    const response = await fetchGlobalWithRetry(fetchFn);

    if (!response.ok) {
        throw new Error(`CoinGecko global request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as CoinGeckoGlobalResponse;
    const cachedCoins = getCachedTopMarketCoins();
    const summary: GlobalMarketSummary = {
        totalMarketCapUsd: payload.data.total_market_cap.usd,
        totalVolumeUsd: payload.data.total_volume.usd,
        marketCapChangePercentage24hUsd: payload.data.market_cap_change_percentage_24h_usd,
        btcDominance: payload.data.market_cap_percentage.btc,
        activeCryptocurrencies: payload.data.active_cryptocurrencies,
        marketCapSparkline7d: buildMarketCapSparkline(cachedCoins?.coins ?? [])
    };

    globalCache = {
        summary,
        fetchedAt: Date.now()
    };

    return summary;
}

export async function getTopMarketCoins(fetchFn: typeof fetch): Promise<MarketCoin[]> {
    const response = await fetchMarketsWithRetry(fetchFn);

    if (!response.ok) {
        throw new Error(`CoinGecko request failed with status ${response.status}`);
    }

    const data = (await response.json()) as CoinGeckoMarketCoin[];
    const normalized = data.map(normalizeCoin);
    marketCache = {
        coins: normalized,
        fetchedAt: Date.now()
    };

    return normalized;
}
