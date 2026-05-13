const fs = require('fs');
const path = require('path');
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');

loadLocalEnv();

const { callLLM, parseJsonResponse } = require('./aiClient');
const {
    getInterviewerProfile,
    buildQuestionMessages,
    buildReportMessages,
    buildFollowupMessages,
    buildResumeMessages
} = require('./prompts');

const app = express();
app.use(cors());
app.use(express.json({ limit: '3mb' }));

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'zhiguanguan',
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10
});

function loadLocalEnv() {
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return;

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;

        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        value = value.replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) process.env[key] = value;
    }
}

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

function parseJsonResponseSafe(value, fallback) {
    if (!value) return fallback;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

async function queryKnowledge({ position = '', company = '', jd = '', knowledgeId = null }) {
    try {
        if (knowledgeId) {
            const [rows] = await db.promise().query(
                'SELECT * FROM knowledge_base WHERE id = ? LIMIT 1',
                [knowledgeId]
            );
            return rows;
        }

        const rawKeywords = `${position} ${company} ${jd}`.match(/[a-zA-Z0-9\u4e00-\u9fa5]{2,}/g) || [];
        const keywords = [...new Set(rawKeywords)]
            .filter((item) => !['岗位', '职责', '要求', '能力', '经验'].includes(item))
            .slice(0, 6);

        if (keywords.length === 0) {
            const [rows] = await db.promise().query(
                'SELECT * FROM knowledge_base ORDER BY created_at DESC LIMIT 5'
            );
            return rows;
        }

        const clauses = [];
        const params = [];
        for (const keyword of keywords) {
            const like = `%${keyword}%`;
            clauses.push('(position LIKE ? OR company LIKE ? OR interview_questions LIKE ? OR tags LIKE ?)');
            params.push(like, like, like, like);
        }

        const [rows] = await db.promise().query(
            `SELECT * FROM knowledge_base WHERE ${clauses.join(' OR ')} ORDER BY created_at DESC LIMIT 6`,
            params
        );
        return rows;
    } catch (error) {
        console.warn('Knowledge query skipped:', error.message);
        return [];
    }
}

function formatKnowledgeContext(rows) {
    return rows.map((item, index) => {
        const questions = item.interview_questions || item.content || '';
        return [
            `资料${index + 1}`,
            `岗位: ${item.position || '未知'}`,
            `公司/场景: ${item.company || '通用'}`,
            `类型: ${item.experience_type || '资料'}`,
            `内容: ${String(questions).slice(0, 800)}`
        ].join('\n');
    }).join('\n\n');
}

function fallbackQuestions({ position, company, jd, interviewerId, questionCount = 6 }) {
    const interviewer = getInterviewerProfile(interviewerId);
    const jdKeywords = (jd || '').match(/[a-zA-Z0-9\u4e00-\u9fa5]{2,}/g) || [];
    const keywords = [...new Set(jdKeywords)].slice(0, 4);
    const role = `${company ? `${company} ` : ''}${position || '目标岗位'}`;

    const questions = [
        `请先做一个 1 分钟自我介绍，并突出你和${role}最匹配的经历。`,
        `你为什么选择${role}？请结合岗位要求说明你的动机和准备。`,
        keywords[0]
            ? `JD 中提到“${keywords[0]}”，请结合你的项目或学习经历谈谈你如何应用它。`
            : `请介绍一个最能体现你专业能力的项目，并说明你的具体贡献。`,
        keywords[1]
            ? `如果工作中遇到与“${keywords[1]}”相关的复杂问题，你会如何分析和推进？`
            : `遇到压力较大、时间紧的任务时，你通常如何拆解并保证结果？`,
        `请用 STAR 法则讲一个你解决困难或推动协作的真实案例。`,
        `如果我是${interviewer.style}面试官，我会追问：你目前距离${role}还有哪些短板，准备怎么补？`,
        `最后，你有什么想反问面试官的问题？`
    ];

    return questions.slice(0, Math.max(4, Math.min(8, questionCount)));
}

function fallbackReport({ type, questions, answers }) {
    const questionList = toArray(questions);
    const answerList = toArray(answers);
    const reviews = questionList.map((question, index) => {
        const answer = answerList[index] || '';
        const lengthScore = answer.length > 220 ? 30 : answer.length > 120 ? 24 : answer.length > 60 ? 18 : answer.length > 20 ? 10 : 2;
        const structureScore = /首先|其次|然后|最后|第一|第二|第三|STAR|情境|任务|行动|结果|因为|所以/.test(answer) ? 20 : 8;
        const evidenceScore = /项目|经历|案例|数据|提升|降低|\d+|%|百分/.test(answer) ? 20 : 8;
        const relevanceScore = answer ? 20 : 0;
        const score = clampScore(20 + lengthScore + structureScore + evidenceScore + relevanceScore, 55);

        return {
            question,
            answer,
            score,
            strengths: answer
                ? ['能够正面回应问题', evidenceScore >= 20 ? '包含一定案例或结果信息' : '具备继续展开的基础']
                : ['暂未作答'],
            problems: [
                structureScore < 20 ? '回答结构还不够清晰，可以用 STAR 或分点表达' : '结构基本清楚',
                evidenceScore < 20 ? '具体案例、数字和岗位关键词还可以更多' : '证据支撑较好'
            ],
            optimizedAnswer: answer
                ? `建议按照“背景-任务-行动-结果-岗位关联”重组：先交代场景，再说明你负责什么、采取了哪些行动、产生了什么结果，最后点出这段经历如何证明你适合${type || '目标岗位'}。`
                : '建议至少用 3-4 句话回应：先表明观点，再结合经历举例，最后回扣岗位要求。',
            followupSuggestion: '可以继续追问候选人在该经历中的具体责任、量化结果和复盘反思。'
        };
    });

    const average = reviews.length
        ? Math.round(reviews.reduce((sum, item) => sum + item.score, 0) / reviews.length)
        : 0;

    const dimensions = {
        jobFit: clampScore(average + 2),
        professional: clampScore(average + 4),
        logic: clampScore(average - 2),
        star: clampScore(average - 5),
        adaptability: clampScore(average),
        communication: clampScore(average + 1)
    };

    return {
        totalScore: average,
        dimensions,
        summary: `本次${type || '模拟面试'}整体得分 ${average} 分。回答已经具备基础内容，但还需要进一步强化结构、案例细节和岗位匹配表达。`,
        questionReviews: reviews,
        strengths: ['能够完成主要问题回应', '具备继续打磨为正式面试答案的基础'],
        weaknesses: ['部分回答缺少量化结果', 'STAR 结构和岗位回扣还可以更明确'],
        trainingPlan: [
            '把每个项目经历整理成 STAR 模板',
            '为核心技能补充 2-3 个可量化成果',
            '针对目标岗位准备 3 个反问问题'
        ],
        recommendedResources: ['岗位专项题库', 'STAR 法则表达训练', '真实面经案例库']
    };
}

function normalizeReport(raw, fallbackInput) {
    const fallback = fallbackReport(fallbackInput);
    if (!raw || typeof raw !== 'object') return fallback;

    const dimensions = raw.dimensions || {};
    const normalized = {
        totalScore: clampScore(raw.totalScore ?? raw.score, fallback.totalScore),
        dimensions: {
            jobFit: clampScore(dimensions.jobFit, fallback.dimensions.jobFit),
            professional: clampScore(dimensions.professional, fallback.dimensions.professional),
            logic: clampScore(dimensions.logic, fallback.dimensions.logic),
            star: clampScore(dimensions.star, fallback.dimensions.star),
            adaptability: clampScore(dimensions.adaptability, fallback.dimensions.adaptability),
            communication: clampScore(dimensions.communication, fallback.dimensions.communication)
        },
        summary: raw.summary || fallback.summary,
        questionReviews: Array.isArray(raw.questionReviews) && raw.questionReviews.length
            ? raw.questionReviews.map((item, index) => ({
                question: item.question || fallback.questionReviews[index]?.question || '',
                answer: item.answer || fallback.questionReviews[index]?.answer || '',
                score: clampScore(item.score, fallback.questionReviews[index]?.score || fallback.totalScore),
                strengths: Array.isArray(item.strengths) ? item.strengths : fallback.questionReviews[index]?.strengths || [],
                problems: Array.isArray(item.problems) ? item.problems : fallback.questionReviews[index]?.problems || [],
                optimizedAnswer: item.optimizedAnswer || fallback.questionReviews[index]?.optimizedAnswer || '',
                followupSuggestion: item.followupSuggestion || fallback.questionReviews[index]?.followupSuggestion || ''
            }))
            : fallback.questionReviews,
        strengths: Array.isArray(raw.strengths) ? raw.strengths : fallback.strengths,
        weaknesses: Array.isArray(raw.weaknesses) ? raw.weaknesses : fallback.weaknesses,
        trainingPlan: Array.isArray(raw.trainingPlan) ? raw.trainingPlan : fallback.trainingPlan,
        recommendedResources: Array.isArray(raw.recommendedResources) ? raw.recommendedResources : fallback.recommendedResources
    };

    return normalized;
}

async function saveInterviewRecord(payload) {
    const {
        userId,
        type,
        position,
        company,
        interviewerId,
        jdText,
        questions,
        answers,
        score,
        aiReport,
        metadata
    } = payload;

    const questionsText = toJsonText(questions, []);
    const answersText = toJsonText(answers, []);
    const reportText = aiReport ? toJsonText(aiReport, {}) : null;
    const metadataText = metadata ? toJsonText(metadata, {}) : null;

    try {
        const [result] = await db.promise().query(
            `INSERT INTO interview_records
            (user_id, type, position, company, interviewer_id, jd_text, questions, answers, score, ai_report, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                type,
                position || type,
                company || null,
                interviewerId || null,
                jdText || null,
                questionsText,
                answersText,
                clampScore(score, 0),
                reportText,
                metadataText
            ]
        );
        return result.insertId;
    } catch (error) {
        if (!/Unknown column|ER_BAD_FIELD_ERROR/i.test(error.message)) {
            throw error;
        }

        const [result] = await db.promise().query(
            'INSERT INTO interview_records (user_id, type, questions, answers, score) VALUES (?, ?, ?, ?, ?)',
            [userId, type, questionsText, answersText, clampScore(score, 0)]
        );
        return result.insertId;
    }
}

app.post('/api/register', async (req, res) => {
    const { username, password, nickname } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: '请输入用户名和密码' });
    }

    try {
        const [existing] = await db.promise().query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: '用户名已存在' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.promise().query(
            'INSERT INTO users (username, password, nickname, points) VALUES (?, ?, ?, 100)',
            [username, hashedPassword, nickname || username]
        );

        res.json({ success: true, message: '注册成功' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const [users] = await db.promise().query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }

        delete user.password;
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/user/:id/points', async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            'SELECT points FROM users WHERE id = ?',
            [req.params.id]
        );
        res.json({ points: rows[0]?.points || 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/knowledge', async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            'SELECT * FROM knowledge_base ORDER BY created_at DESC'
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/knowledge/search/:keyword', async (req, res) => {
    try {
        const keyword = `%${req.params.keyword}%`;
        const [rows] = await db.promise().query(
            'SELECT * FROM knowledge_base WHERE position LIKE ? OR company LIKE ? OR interview_questions LIKE ? OR tags LIKE ?',
            [keyword, keyword, keyword, keyword]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/knowledge/:id', async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            'SELECT * FROM knowledge_base WHERE id = ?',
            [req.params.id]
        );
        res.json(rows[0] || null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/forum/posts', async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            `SELECT p.*, u.nickname AS author_name,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS reply_count
            FROM forum_posts p
            LEFT JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/forum/post', async (req, res) => {
    const { userId, title, content, category } = req.body;

    try {
        const [result] = await db.promise().query(
            'INSERT INTO forum_posts (user_id, title, content, category) VALUES (?, ?, ?, ?)',
            [userId, title, content, category || '面经']
        );

        await db.promise().query(
            'UPDATE users SET points = points + 10 WHERE id = ?',
            [userId]
        );

        res.json({ success: true, id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/forum/post/:id', async (req, res) => {
    try {
        const [post] = await db.promise().query(
            `SELECT p.*, u.nickname AS author_name
            FROM forum_posts p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.id = ?`,
            [req.params.id]
        );

        const [comments] = await db.promise().query(
            `SELECT c.*, u.nickname AS user_name
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.post_id = ?
            ORDER BY c.created_at ASC`,
            [req.params.id]
        );

        res.json(post[0] ? { ...post[0], comments } : null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/forum/post/:id/comment', async (req, res) => {
    const { userId, content } = req.body;
    const postId = req.params.id;

    try {
        await db.promise().query(
            'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
            [postId, userId, content]
        );

        await db.promise().query(
            'UPDATE users SET points = points + 5 WHERE id = ?',
            [userId]
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/mentors', async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            'SELECT * FROM mentors ORDER BY rating DESC'
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/mentors/:id', async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            'SELECT * FROM mentors WHERE id = ?',
            [req.params.id]
        );
        res.json(rows[0] || null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/bookings', async (req, res) => {
    const { userId, mentorId, type, time } = req.body;

    try {
        const [result] = await db.promise().query(
            'INSERT INTO bookings (user_id, mentor_id, type, booking_time) VALUES (?, ?, ?, ?)',
            [userId, mentorId, type, time || new Date()]
        );
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/resumes', async (req, res) => {
    const {
        userId,
        text,
        resumeText,
        targetPosition,
        fileName,
        sourceType = fileName ? 'txt' : 'text'
    } = req.body;

    const rawText = String(text || resumeText || '').trim();
    if (!userId) {
        return res.status(400).json({ error: '缺少用户ID' });
    }
    if (!rawText) {
        return res.status(400).json({ error: '请输入或上传简历文本' });
    }
    if (rawText.length > 60000) {
        return res.status(400).json({ error: '简历文本过长，请先精简到 6 万字以内' });
    }

    const fallbackInput = {
        resumeText: rawText,
        targetPosition,
        nickname: req.body.nickname
    };
    let summary;
    let source = 'ai';

    try {
        const messages = buildResumeMessages({
            resumeText: rawText.slice(0, 18000),
            targetPosition,
            nickname: req.body.nickname
        });
        const content = await callLLM({ messages, temperature: 0.2, responseFormat: 'json_object' });
        summary = normalizeResumeSummary(parseJsonResponse(content), fallbackInput);
    } catch (error) {
        source = 'fallback';
        summary = fallbackResumeSummary(fallbackInput);
        summary.warning = error.message;
    }

    try {
        const [result] = await db.promise().query(
            `INSERT INTO resumes
            (user_id, file_name, source_type, target_position, raw_text, summary_json, summary_text, parse_source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                fileName || null,
                sourceType,
                targetPosition || summary.targetPosition || null,
                rawText,
                JSON.stringify(summary),
                toSummaryText(summary),
                source
            ]
        );

        res.json({
            success: true,
            id: result.insertId,
            source,
            resume: {
                id: result.insertId,
                user_id: userId,
                file_name: fileName || null,
                source_type: sourceType,
                target_position: targetPosition || summary.targetPosition || null,
                raw_text: rawText,
                summary_json: JSON.stringify(summary),
                summary_text: toSummaryText(summary),
                parse_source: source,
                summary
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/resumes/:userId', async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            'SELECT * FROM resumes WHERE user_id = ? ORDER BY updated_at DESC, created_at DESC',
            [req.params.userId]
        );
        res.json(rows.map(serializeResumeRow));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/resume/:id', async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            'SELECT * FROM resumes WHERE id = ? LIMIT 1',
            [req.params.id]
        );
        res.json(serializeResumeRow(rows[0]) || null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/ai/interview/generate', async (req, res) => {
    const {
        position,
        company,
        jd,
        interviewerId,
        interviewer,
        knowledgeId,
        resumeId,
        resumeSummary,
        questionCount = 6
    } = req.body;

    if (!position) {
        return res.status(400).json({ error: '请输入岗位名称' });
    }

    const profile = getInterviewerProfile(interviewerId || interviewer?.id);
    const knowledgeRows = await queryKnowledge({ position, company, jd, knowledgeId });
    const knowledgeContext = formatKnowledgeContext(knowledgeRows);
    let resolvedResumeSummary = resumeSummary || '';
    if (!resolvedResumeSummary && resumeId) {
        try {
            const [resumeRows] = await db.promise().query(
                'SELECT summary_text, summary_json FROM resumes WHERE id = ? LIMIT 1',
                [resumeId]
            );
            const resume = resumeRows[0];
            resolvedResumeSummary = resume?.summary_text || toSummaryText(parseJsonResponseSafe(resume?.summary_json, null));
        } catch (error) {
            console.warn('Resume lookup skipped:', error.message);
        }
    }
    const fallback = fallbackQuestions({
        position,
        company,
        jd: [jd, resolvedResumeSummary].filter(Boolean).join('\n'),
        interviewerId: profile.id,
        questionCount: Number(questionCount) || 6
    });

    try {
        const messages = buildQuestionMessages({
            position,
            company,
            jd,
            interviewer: profile,
            knowledgeContext,
            resumeSummary: resolvedResumeSummary,
            questionCount: Number(questionCount) || 6
        });
        const content = await callLLM({ messages, temperature: 0.45, responseFormat: 'json_object' });
        const parsed = parseJsonResponse(content);
        const questions = Array.isArray(parsed.questions)
            ? parsed.questions.map((item) => String(item).trim()).filter(Boolean)
            : [];

        res.json({
            success: true,
            source: 'ai',
            interviewer: profile,
            questions: questions.length ? questions.slice(0, 8) : fallback,
            profile: parsed.profile || null,
            knowledgeUsed: knowledgeRows.map((item) => item.id)
        });
    } catch (error) {
        console.warn('AI question generation fallback:', error.message);
        res.json({
            success: true,
            source: 'fallback',
            interviewer: profile,
            questions: fallback,
            profile: null,
            warning: error.message
        });
    }
});

app.post('/api/ai/interview/followup', async (req, res) => {
    const {
        position,
        company,
        interviewerId,
        question,
        answer,
        resumeSummary,
        previousQuestions = []
    } = req.body;

    if (!question || !answer) {
        return res.status(400).json({ error: '缺少问题或回答' });
    }

    const profile = getInterviewerProfile(interviewerId);

    try {
        const messages = buildFollowupMessages({
            position,
            company,
            interviewer: profile,
            question,
            answer,
            resumeSummary,
            previousQuestions
        });
        const content = await callLLM({ messages, temperature: 0.35, responseFormat: 'json_object' });
        const parsed = parseJsonResponse(content);
        res.json({
            success: true,
            source: 'ai',
            followup: parsed.followup || '请补充一个更具体的项目例子，并说明你的行动和结果。'
        });
    } catch (error) {
        res.json({
            success: true,
            source: 'fallback',
            followup: '请补充一个更具体的项目例子，并说明你的行动、结果和复盘。'
        });
    }
});

app.post('/api/ai/interview/report', async (req, res) => {
    const {
        userId,
        type,
        position,
        company,
        jd,
        interviewerId,
        resumeId,
        resumeSummary,
        questions,
        answers,
        startedAt,
        save = false
    } = req.body;

    const questionList = toArray(questions);
    const answerList = toArray(answers);
    const profile = getInterviewerProfile(interviewerId);
    const fallbackInput = {
        type: type || position,
        questions: questionList,
        answers: answerList
    };

    let report;
    let source = 'ai';

    try {
        const knowledgeRows = await queryKnowledge({ position: position || type, company, jd });
        const messages = buildReportMessages({
            type: type || position,
            position: position || type,
            company,
            jd,
            interviewer: profile,
            questions: questionList,
            answers: answerList,
            resumeSummary,
            knowledgeContext: formatKnowledgeContext(knowledgeRows)
        });
        const content = await callLLM({ messages, temperature: 0.25, responseFormat: 'json_object' });
        report = normalizeReport(parseJsonResponse(content), fallbackInput);
    } catch (error) {
        source = 'fallback';
        report = fallbackReport(fallbackInput);
        report.warning = error.message;
    }

    let recordId = null;
    if (save && userId) {
        try {
            recordId = await saveInterviewRecord({
                userId,
                type: type || position || 'AI面试',
                position: position || type || null,
                company,
                interviewerId: profile.id,
                jdText: jd,
                questions: questionList,
                answers: answerList,
                score: report.totalScore,
                aiReport: report,
                metadata: { source, startedAt, finishedAt: new Date().toISOString(), resumeId: resumeId || null, resumeSummary: resumeSummary || null }
            });
        } catch (error) {
            console.warn('Saving AI report failed:', error.message);
        }
    }

    res.json({
        success: true,
        source,
        recordId,
        interviewer: profile,
        report
    });
});

app.post('/api/interview/save', async (req, res) => {
    const {
        userId,
        type,
        position,
        company,
        interviewerId,
        jdText,
        questions,
        answers,
        score,
        aiReport,
        metadata
    } = req.body;

    try {
        const id = await saveInterviewRecord({
            userId,
            type,
            position,
            company,
            interviewerId,
            jdText,
            questions,
            answers,
            score,
            aiReport,
            metadata
        });
        res.json({ success: true, id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/interview/history/:userId', async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            'SELECT * FROM interview_records WHERE user_id = ? ORDER BY created_at DESC',
            [req.params.userId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
    console.log(`职引官后端服务运行在 http://localhost:${PORT}`);
});
