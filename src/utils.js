function toJsonText(value, fallback = null) {
    if (value === undefined || value === null) {
        return JSON.stringify(fallback);
    }

    if (typeof value === 'string') {
        try {
            JSON.parse(value);
            return value;
        } catch {
            return JSON.stringify(value);
        }
    }

    return JSON.stringify(value);
}

function toArray(value) {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
        }
    }
    return [];
}

function clampScore(value, fallback = 70) {
    const score = Number(value);
    if (!Number.isFinite(score)) return fallback;
    return Math.max(0, Math.min(100, Math.round(score)));
}

function toSummaryText(summary) {
    if (!summary || typeof summary !== 'object') return '';
    const parts = [
        summary.summaryText,
        summary.name ? `候选人: ${summary.name}` : '',
        summary.targetPosition ? `目标岗位: ${summary.targetPosition}` : '',
        toArray(summary.education).length ? `教育背景: ${toArray(summary.education).join('；')}` : '',
        toArray(summary.projects).length ? `项目经历: ${toArray(summary.projects).join('；')}` : '',
        toArray(summary.skills).length ? `技能标签: ${toArray(summary.skills).join('、')}` : '',
        toArray(summary.highlights).length ? `优势亮点: ${toArray(summary.highlights).join('；')}` : '',
        toArray(summary.weaknesses).length ? `潜在短板: ${toArray(summary.weaknesses).join('；')}` : ''
    ].filter(Boolean);
    return parts.join('\n').slice(0, 2000);
}

function uniqueItems(items, limit = 8) {
    return [...new Set(items.map((item) => String(item).trim()).filter(Boolean))].slice(0, limit);
}

function extractSectionLines(text, keywords, stopKeywords = []) {
    const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const result = [];
    let collecting = false;
    for (const line of lines) {
        const isStart = keywords.some((keyword) => line.includes(keyword));
        const isStop = collecting && stopKeywords.some((keyword) => line.includes(keyword));
        if (isStart) {
            collecting = true;
            result.push(line.replace(/^[#\-\s：:]+/, ''));
            continue;
        }
        if (isStop) collecting = false;
        if (collecting && result.length < 5) result.push(line);
    }
    return uniqueItems(result, 5);
}

function parseJsonResponseSafe(value, fallback) {
    if (!value) return fallback;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

module.exports = {
    toJsonText,
    toArray,
    clampScore,
    toSummaryText,
    uniqueItems,
    extractSectionLines,
    parseJsonResponseSafe
};
