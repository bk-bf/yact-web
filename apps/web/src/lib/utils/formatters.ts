// Number formatters and display utilities shared across markets views.

export const usd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
});

export const percent = new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 2,
    signDisplay: "always",
});

export const fullUsd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
});

const largeUsd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
});

export const compactNumber = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
});

const fullInteger = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
});

export const signedPercent = new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 2,
    signDisplay: "always",
});

export function formatDetailedUsd(value: number): string {
    return value >= 1000 ? largeUsd.format(value) : smartUsd(value);
}

export function formatStableCompactUsd(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "--";
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
    if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
}

export function formatTwoDecimals(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "--";
    return value.toFixed(2);
}

export function formatWhole(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "--";
    return fullInteger.format(value);
}

export function displayCoinName(value: string): string {
    return value
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Smart coin price formatter.
 * - >= $1000  → no decimals (e.g. $94,123)
 * - >= $1     → 2 decimals (e.g. $3.45)
 * - >= $0.01  → 4 decimals (e.g. $0.0123)
 * - >= $0.0001 → 5 significant decimal digits after the leading zeros
 * - < $0.0001  → up to 8 significant decimal digits
 */
export function smartUsd(value: number): string {
    if (!Number.isFinite(value)) return "--";
    const abs = Math.abs(value);
    if (abs === 0) return "$0.00";
    if (abs >= 1000) return largeUsd.format(value);
    if (abs >= 1) return fullUsd.format(value);
    if (abs >= 0.01) {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 4,
            maximumFractionDigits: 4,
        }).format(value);
    }
    // For very small values, find the first significant digit position
    // and show 4 significant digits from there.
    const log = Math.floor(Math.log10(abs));       // e.g. -4 for 0.00012
    const decimals = Math.min(-log + 3, 12);        // 4 sig digits past leading zeros
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
}
