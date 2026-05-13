const { toArray, toJsonText, parseJsonResponseSafe } = require('./utils');

const DEFAULT_JOB_TEMPLATES = [
    {
        name: '产品经理',
        industry: '互联网',
        abilityModel: ['用户洞察', '需求分析', '数据判断', '跨部门推进', '商业理解'],
        commonQuestions: [
            '请分析一款你常用产品的核心用户、使用场景和增长机会。',
            '如果核心功能上线后留存下降，你会如何定位原因并推进优化？',
            '请讲一个你推动跨部门协作并落地需求的经历。',
            '你如何判断一个需求是否值得做？会看哪些数据和用户反馈？',
            '如果研发资源不足但业务方强烈要求上线，你会如何取舍？'
        ],
        keywords: ['产品经理', '用户研究', '需求分析', '数据分析', 'A/B测试', '用户增长', '原型', 'PRD'],
        trainingAdvice: ['准备一个完整产品分析案例', '用 STAR 复盘跨部门项目', '练习用数据解释需求优先级']
    },
    {
        name: 'Java开发',
        industry: '互联网技术',
        abilityModel: ['Java基础', 'JVM', '并发编程', '数据库', '系统设计', '线上排障'],
        commonQuestions: [
            '请介绍你最熟悉的一个后端项目，以及你负责的核心模块。',
            'HashMap 的扩容机制和线程安全风险是什么？',
            'JVM 内存区域如何划分？线上 OOM 你会如何排查？',
            '如何设计一个高并发接口，并保证数据一致性？',
            '请讲一次你定位接口响应变慢或线上故障的经历。'
        ],
        keywords: ['Java', 'Spring', 'Spring Boot', 'JVM', 'MySQL', 'Redis', '并发', '微服务', '性能优化'],
        trainingAdvice: ['复盘一个能讲清架构取舍的项目', '准备 JVM/并发/数据库高频题', '补充线上排障的指标和工具链']
    },
    {
        name: '金融数据分析',
        industry: '金融',
        abilityModel: ['SQL', 'Python', '统计分析', '金融业务理解', '风险意识', '可视化表达'],
        commonQuestions: [
            '请介绍一个你做过的数据分析项目，包括目标、方法和结论。',
            'SQL 窗口函数适合解决什么问题？请举例。',
            '如果业务方认为你的数据结论不符合直觉，你会如何沟通？',
            '估值模型中的核心假设会如何影响结果？',
            '如何识别数据异常，并判断是否需要剔除？'
        ],
        keywords: ['金融', '数据分析', 'SQL', 'Python', 'Excel', '估值模型', '风控', '可视化', '统计'],
        trainingAdvice: ['准备一段从数据到业务建议的完整案例', '练习 SQL 高频分析题', '补充金融指标和风险解释能力']
    },
    {
        name: '新媒体运营',
        industry: '互联网运营',
        abilityModel: ['内容策划', '用户增长', '活动运营', '数据复盘', '热点捕捉', '社群运营'],
        commonQuestions: [
            '请介绍一次你策划内容或活动并带来增长的经历。',
            '如果账号阅读量连续下降，你会如何诊断并调整？',
            '如何设计一次面向新用户的拉新活动？',
            '你如何判断一篇内容是否值得继续放大投放？',
            '请讲一个你处理用户负面反馈或社群冲突的案例。'
        ],
        keywords: ['运营', '新媒体', '内容策划', '用户增长', '活动运营', '社群', '数据复盘', '转化率'],
        trainingAdvice: ['准备内容增长案例和关键数据', '练习活动方案拆解', '建立复盘指标框架']
    }
];

function normalizeJobTemplateRow(row) {
    if (!row) return null;
    if (typeof row === 'string') {
        return normalizeJobTemplateRow(parseJsonResponseSafe(row, null));
    }
    return {
        ...row,
        ability_model: toArray(row.ability_model || row.abilityModel),
        common_questions: toArray(row.common_questions || row.commonQuestions),
        keywords: toArray(row.keywords),
        training_advice: toArray(row.training_advice || row.trainingAdvice)
    };
}

function formatJobTemplateContext(template) {
    if (!template) return '';
    const normalized = normalizeJobTemplateRow(template);
    return [
        `岗位名称: ${normalized.name}`,
        `行业: ${normalized.industry || '通用'}`,
        `能力模型: ${normalized.ability_model.join('、') || '未配置'}`,
        `关键词: ${normalized.keywords.join('、') || '未配置'}`,
        `常见问题: ${normalized.common_questions.join('；') || '未配置'}`,
        `训练建议: ${normalized.training_advice.join('；') || '未配置'}`
    ].join('\n').slice(0, 2000);
}

function buildTemplateSummary(template) {
    if (!template) return null;
    const normalized = normalizeJobTemplateRow(template);
    return {
        id: normalized.id,
        name: normalized.name,
        industry: normalized.industry,
        abilityModel: normalized.ability_model,
        keywords: normalized.keywords,
        trainingAdvice: normalized.training_advice
    };
}

function createJobTemplateService(db) {
    async function ensureColumn(tableName, columnName, definition) {
        const [rows] = await db.promise().query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [tableName, columnName]
        );
        if (!rows.length) {
            await db.promise().query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
        }
    }

    async function ensureJobTemplateTables() {
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS job_templates (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(120) NOT NULL,
                industry VARCHAR(120) DEFAULT NULL,
                ability_model LONGTEXT,
                common_questions LONGTEXT,
                keywords LONGTEXT,
                training_advice LONGTEXT,
                popularity INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_job_templates_name_industry (name, industry),
                INDEX idx_job_templates_name (name),
                INDEX idx_job_templates_industry (industry)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await ensureColumn('interview_sessions', 'template_id', 'INT DEFAULT NULL');
        await ensureColumn('interview_sessions', 'template_summary', 'LONGTEXT');

        for (const template of DEFAULT_JOB_TEMPLATES) {
            await db.promise().query(
                `INSERT INTO job_templates
                (name, industry, ability_model, common_questions, keywords, training_advice, popularity)
                SELECT ?, ?, ?, ?, ?, ?, ?
                WHERE NOT EXISTS (
                    SELECT 1 FROM job_templates WHERE name = ? AND COALESCE(industry, '') = COALESCE(?, '')
                )`,
                [
                    template.name,
                    template.industry,
                    toJsonText(template.abilityModel, []),
                    toJsonText(template.commonQuestions, []),
                    toJsonText(template.keywords, []),
                    toJsonText(template.trainingAdvice, []),
                    100,
                    template.name,
                    template.industry
                ]
            );
        }
    }

    async function getJobTemplateById(id) {
        if (!id) return null;
        const [rows] = await db.promise().query('SELECT * FROM job_templates WHERE id = ? LIMIT 1', [id]);
        return normalizeJobTemplateRow(rows[0]);
    }

    async function matchJobTemplate({ templateId, position = '', jd = '' }) {
        const byId = await getJobTemplateById(templateId);
        if (byId) return byId;

        const text = `${position} ${jd}`.trim();
        if (!text) return null;
        const [rows] = await db.promise().query(
            `SELECT * FROM job_templates
            WHERE ? LIKE CONCAT('%', name, '%')
               OR name LIKE ?
               OR industry LIKE ?
               OR keywords LIKE ?
            ORDER BY popularity DESC, updated_at DESC
            LIMIT 1`,
            [text, `%${position}%`, `%${position}%`, `%${position}%`]
        );
        return normalizeJobTemplateRow(rows[0]);
    }

    return {
        ensureJobTemplateTables,
        getJobTemplateById,
        matchJobTemplate
    };
}

module.exports = {
    createJobTemplateService,
    normalizeJobTemplateRow,
    formatJobTemplateContext,
    buildTemplateSummary
};
