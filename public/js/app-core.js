window.ZYGCore = (() => {
    const API_BASE = `${window.location.origin || 'http://localhost:3000'}/api`;
    const ACTIVE_SESSION_KEY = 'activeInterviewSessionId';

    function getPreviewUser() {
        return {
            id: 1,
            username: 'dev',
            nickname: '开发预览',
            points: 999
        };
    }

    function asArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function parseJsonField(value, fallback) {
        if (value === undefined || value === null) return fallback;
        if (typeof value !== 'string') return value;

        let parsed = value;
        for (let i = 0; i < 2; i++) {
            if (typeof parsed !== 'string') break;
            try {
                parsed = JSON.parse(parsed);
            } catch (error) {
                return fallback;
            }
        }
        return parsed ?? fallback;
    }

    function escapeHTML(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderSimpleList(items) {
        const list = asArray(items).filter(Boolean);
        if (list.length === 0) return '<div style="color: #8aa08a;">暂无</div>';
        return list.map(item => `<div style="margin: 6px 0;">• ${escapeHTML(item)}</div>`).join('');
    }

    function getRecordAIReport(record) {
        return parseJsonField(record?.ai_report || record?.aiReport, null);
    }

    function getHistoryRecordId(record) {
        return String(record?.id ?? record?.recordId ?? '');
    }

    function getSessionNumericId(value) {
        if (!value) return null;
        const text = String(value);
        return text.startsWith('session-') ? text.replace('session-', '') : text;
    }

    return {
        API_BASE,
        ACTIVE_SESSION_KEY,
        getPreviewUser,
        asArray,
        parseJsonField,
        escapeHTML,
        renderSimpleList,
        getRecordAIReport,
        getHistoryRecordId,
        getSessionNumericId
    };
})();
