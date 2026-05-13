const {
    toArray,
    toSummaryText,
    uniqueItems,
    extractSectionLines,
    parseJsonResponseSafe
} = require('./utils');

function fallbackResumeSummary({ resumeText, targetPosition, nickname }) {
    const text = String(resumeText || '');
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const firstLine = lines.find((line) => /^[\u4e00-\u9fa5A-Za-z\s]{2,30}$/.test(line) && !/简历|求职|岗位|电话|邮箱/.test(line));
    const emailName = text.match(/([A-Za-z0-9._%+-]+)@[A-Za-z0-9.-]+/)?.[1];
    const name = firstLine || nickname || emailName || '求职者';
    const roleMatch = text.match(/(?:目标岗位|求职意向|应聘岗位|岗位)[:：\s]*([^\n\r，,；;]{2,40})/);
    const skills = uniqueItems(
        (text.match(/JavaScript|TypeScript|React|Vue|Node\.?js|Express|MySQL|SQL|Python|Java|Spring|Linux|Docker|Redis|Excel|Tableau|PowerBI|产品|运营|数据分析|用户研究|项目管理|机器学习|深度学习|NLP/gi) || [])
            .map((item) => item.replace(/^nodejs$/i, 'Node.js')),
        10
    );
    const education = extractSectionLines(text, ['教育', '学历', '院校', '大学', '学院'], ['项目', '实习', '工作', '技能']);
    const projects = extractSectionLines(text, ['项目', '实践', '作品', '经历'], ['教育', '技能', '证书', '自我评价']);
    const highlights = [];
    if (projects.length) highlights.push('具备可展开追问的项目或实践经历');
    if (skills.length >= 3) highlights.push(`技能覆盖较完整，包括 ${skills.slice(0, 4).join('、')}`);
    if (/\d+|%|百分|提升|增长|降低|优化|负责|主导/.test(text)) highlights.push('简历中包含一定结果或行动描述');

    const weaknesses = [];
    if (!targetPosition && !roleMatch) weaknesses.push('目标岗位还不够明确，建议补充求职意向');
    if (!projects.length) weaknesses.push('项目经历信息偏少，面试中可能缺少案例支撑');
    if (!/\d+|%|百分|提升|增长|降低/.test(text)) weaknesses.push('量化成果较少，建议补充数据化结果');

    const summaryText = [
        `${name}正在准备${targetPosition || roleMatch?.[1] || '目标岗位'}面试。`,
        education.length ? `教育背景包含${education[0]}。` : '',
        projects.length ? `主要经历包括${projects.slice(0, 2).join('；')}。` : '',
        skills.length ? `核心技能包括${skills.slice(0, 6).join('、')}。` : ''
    ].filter(Boolean).join('');

    return {
        name,
        targetPosition: targetPosition || roleMatch?.[1] || '',
        education,
        projects,
        skills,
        highlights: highlights.length ? highlights : ['已提供基础简历文本，可用于定制面试问题'],
        weaknesses: weaknesses.length ? weaknesses : ['可继续补充更明确的岗位关键词、量化成果和项目职责边界'],
        summaryText: summaryText.slice(0, 180) || '已保存简历文本，后续面试可结合简历内容生成问题。'
    };
}

function normalizeResumeSummary(raw, fallbackInput) {
    const fallback = fallbackResumeSummary(fallbackInput);
    if (!raw || typeof raw !== 'object') return fallback;
    return {
        name: raw.name || fallback.name,
        targetPosition: raw.targetPosition || raw.position || fallback.targetPosition,
        education: toArray(raw.education).length ? toArray(raw.education) : fallback.education,
        projects: toArray(raw.projects || raw.projectExperience).length ? toArray(raw.projects || raw.projectExperience) : fallback.projects,
        skills: toArray(raw.skills || raw.skillTags).length ? uniqueItems(toArray(raw.skills || raw.skillTags), 12) : fallback.skills,
        highlights: toArray(raw.highlights || raw.strengths).length ? toArray(raw.highlights || raw.strengths) : fallback.highlights,
        weaknesses: toArray(raw.weaknesses || raw.risks).length ? toArray(raw.weaknesses || raw.risks) : fallback.weaknesses,
        summaryText: raw.summaryText || raw.summary || fallback.summaryText
    };
}

function serializeResumeRow(row) {
    if (!row) return null;
    return {
        ...row,
        summary: parseJsonResponseSafe(row.summary_json, null)
    };
}

module.exports = {
    fallbackResumeSummary,
    normalizeResumeSummary,
    serializeResumeRow,
    toSummaryText
};
