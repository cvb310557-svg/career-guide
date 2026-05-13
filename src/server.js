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
const { toArray, toJsonText, toSummaryText, parseJsonResponseSafe } = require('./utils');
const {
    fallbackResumeSummary,
    normalizeResumeSummary,
    serializeResumeRow
} = require('./resumeService');
const {
    createJobTemplateService,
    normalizeJobTemplateRow,
    formatJobTemplateContext,
    buildTemplateSummary
} = require('./jobTemplateService');
const {
    createInterviewService,
    formatKnowledgeContext,
    fallbackQuestions: buildFallbackQuestions,
    fallbackReport,
    normalizeReport
} = require('./interviewService');

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

const jobTemplateService = createJobTemplateService(db);
const {
    ensureJobTemplateTables,
    getJobTemplateById,
    matchJobTemplate
} = jobTemplateService;

const interviewService = createInterviewService({ db, getInterviewerProfile });
const {
    ensureInterviewSessionTables,
    queryKnowledge,
    saveInterviewRecord,
    serializeSessionRow,
    getSessionPayload,
    saveInterviewTurn
} = interviewService;

function fallbackQuestions(options) {
    return buildFallbackQuestions({ ...options, getInterviewerProfile });
}


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

app.get('/api/job-templates', async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            'SELECT * FROM job_templates ORDER BY popularity DESC, updated_at DESC'
        );
        res.json(rows.map(normalizeJobTemplateRow));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/job-templates/search/:keyword', async (req, res) => {
    try {
        const keyword = `%${req.params.keyword || ''}%`;
        const [rows] = await db.promise().query(
            `SELECT * FROM job_templates
            WHERE name LIKE ? OR industry LIKE ? OR keywords LIKE ? OR ability_model LIKE ?
            ORDER BY popularity DESC, updated_at DESC
            LIMIT 10`,
            [keyword, keyword, keyword, keyword]
        );
        res.json(rows.map(normalizeJobTemplateRow));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/job-templates/:id', async (req, res) => {
    try {
        const template = await getJobTemplateById(req.params.id);
        if (!template) return res.status(404).json({ error: '岗位模板不存在' });
        res.json(template);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/ai/interview/generate', async (req, res) => {
    const {
        position,
        company,
        jd,
        templateId,
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
    const jobTemplate = await matchJobTemplate({ templateId, position, jd });
    const jobTemplateContext = formatJobTemplateContext(jobTemplate);
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
        jd: [jobTemplateContext, jd, resolvedResumeSummary].filter(Boolean).join('\n'),
        interviewerId: profile.id,
        questionCount: Number(questionCount) || 6
    });

    try {
        const messages = buildQuestionMessages({
            position,
            company,
            jd,
            interviewer: profile,
            jobTemplateContext,
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
            template: buildTemplateSummary(jobTemplate),
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
            template: buildTemplateSummary(jobTemplate),
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
        templateId,
        templateSummary,
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
    const jobTemplate = await matchJobTemplate({ templateId, position: position || type, jd });
    const resolvedTemplateSummary = templateSummary || buildTemplateSummary(jobTemplate);
    const jobTemplateContext = formatJobTemplateContext(jobTemplate || resolvedTemplateSummary);

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
            jobTemplateContext,
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
                metadata: {
                    source,
                    startedAt,
                    finishedAt: new Date().toISOString(),
                    resumeId: resumeId || null,
                    resumeSummary: resumeSummary || null,
                    templateId: resolvedTemplateSummary?.id || templateId || null,
                    templateSummary: resolvedTemplateSummary || null
                }
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

app.post('/api/interview/sessions', async (req, res) => {
    const {
        userId,
        type,
        position,
        company,
        jd,
        jdText,
        templateId,
        templateSummary,
        interviewerId,
        resumeId,
        resumeSummary,
        questions = [],
        aiSource
    } = req.body;

    const questionList = toArray(questions);
    if (!userId) return res.status(400).json({ error: '缺少用户ID' });
    if (!questionList.length) return res.status(400).json({ error: '缺少面试问题' });

    try {
        const jobTemplate = await matchJobTemplate({ templateId, position: position || type, jd: jdText || jd });
        const resolvedTemplateSummary = templateSummary || buildTemplateSummary(jobTemplate);
        const [result] = await db.promise().query(
            `INSERT INTO interview_sessions
            (user_id, type, position, company, interviewer_id, jd_text, template_id, template_summary, resume_id, resume_summary, questions, status, ai_source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'in_progress', ?)`,
            [
                userId,
                type || position || 'AI面试',
                position || type || null,
                company || null,
                interviewerId || null,
                jdText || jd || null,
                resolvedTemplateSummary?.id || templateId || null,
                resolvedTemplateSummary ? toJsonText(resolvedTemplateSummary, {}) : null,
                resumeId || null,
                resumeSummary || null,
                toJsonText(questionList, []),
                aiSource || null
            ]
        );

        res.json({ success: true, session: await getSessionPayload(result.insertId) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/interview/sessions/:id', async (req, res) => {
    try {
        const session = await getSessionPayload(req.params.id);
        if (!session) return res.status(404).json({ error: '会话不存在' });
        res.json(session);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/interview/sessions/user/:userId', async (req, res) => {
    try {
        const [sessions] = await db.promise().query(
            'SELECT * FROM interview_sessions WHERE user_id = ? ORDER BY updated_at DESC, started_at DESC',
            [req.params.userId]
        );
        const sessionIds = sessions.map((item) => item.id);
        let turns = [];
        if (sessionIds.length) {
            const [turnRows] = await db.promise().query(
                `SELECT * FROM interview_turns WHERE session_id IN (${sessionIds.map(() => '?').join(',')}) ORDER BY session_id ASC, question_index ASC`,
                sessionIds
            );
            turns = turnRows;
        }
        res.json(sessions.map((session) => serializeSessionRow(
            session,
            turns.filter((turn) => turn.session_id === session.id)
        )));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/interview/sessions/:id/turns', async (req, res) => {
    try {
        const session = await getSessionPayload(req.params.id);
        if (!session) return res.status(404).json({ error: '会话不存在' });
        if (session.status === 'finished') return res.status(400).json({ error: '面试已结束' });

        await saveInterviewTurn(req.params.id, req.body);
        res.json({ success: true, session: await getSessionPayload(req.params.id) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/interview/sessions/:id/followup', async (req, res) => {
    try {
        const session = await getSessionPayload(req.params.id);
        if (!session) return res.status(404).json({ error: '会话不存在' });
        if (session.status === 'finished') return res.status(400).json({ error: '面试已结束' });

        const {
            questionIndex,
            question,
            answer,
            previousQuestions = session.questions
        } = req.body;
        const profile = getInterviewerProfile(session.interviewer_id);
        let followup = '请补充一个更具体的项目例子，并说明你的行动、结果和复盘。';
        let source = 'fallback';

        if (question && answer) {
            await saveInterviewTurn(req.params.id, {
                questionIndex,
                question,
                answer,
                kind: req.body.kind || 'base',
                aiSource: req.body.aiSource || null
            });
        }

        try {
            const messages = buildFollowupMessages({
                position: session.position,
                company: session.company,
                interviewer: profile,
                question,
                answer,
                resumeSummary: session.resume_summary,
                previousQuestions
            });
            const content = await callLLM({ messages, temperature: 0.35, responseFormat: 'json_object' });
            const parsed = parseJsonResponse(content);
            followup = parsed.followup || followup;
            source = 'ai';
        } catch (error) {
            console.warn('Session followup fallback:', error.message);
        }

        const allQuestions = session.questions.slice();
        const insertAt = Math.min(allQuestions.length, Number(questionIndex) + 1);
        allQuestions.splice(insertAt, 0, followup);
        await db.promise().query(
            'UPDATE interview_sessions SET questions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [toJsonText(allQuestions, []), req.params.id]
        );
        await saveInterviewTurn(req.params.id, {
            questionIndex: insertAt,
            question: followup,
            answer: '',
            kind: 'followup',
            aiSource: source
        });

        res.json({
            success: true,
            source,
            followup,
            session: await getSessionPayload(req.params.id)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/interview/sessions/:id/finish', async (req, res) => {
    try {
        const session = await getSessionPayload(req.params.id);
        if (!session) return res.status(404).json({ error: '会话不存在' });

        const questionList = toArray(req.body.questions).length ? toArray(req.body.questions) : session.questions;
        const answerList = toArray(req.body.answers).length ? toArray(req.body.answers) : session.answers;
        const profile = getInterviewerProfile(session.interviewer_id);
        const fallbackInput = {
            type: session.type || session.position,
            questions: questionList,
            answers: answerList
        };
        let report;
        let source = 'ai';
        const jobTemplate = session.template_id
            ? await getJobTemplateById(session.template_id)
            : null;
        const jobTemplateContext = formatJobTemplateContext(jobTemplate || session.template_summary);

        try {
            const knowledgeRows = await queryKnowledge({
                position: session.position || session.type,
                company: session.company,
                jd: session.jd_text
            });
            const messages = buildReportMessages({
                type: session.type || session.position,
                position: session.position || session.type,
                company: session.company,
                jd: session.jd_text,
                interviewer: profile,
                questions: questionList,
                answers: answerList,
                resumeSummary: session.resume_summary,
                jobTemplateContext,
                knowledgeContext: formatKnowledgeContext(knowledgeRows)
            });
            const content = await callLLM({ messages, temperature: 0.25, responseFormat: 'json_object' });
            report = normalizeReport(parseJsonResponse(content), fallbackInput);
        } catch (error) {
            source = 'fallback';
            report = fallbackReport(fallbackInput);
            report.warning = error.message;
        }

        await db.promise().query(
            `UPDATE interview_sessions
            SET questions = ?, status = 'finished', total_score = ?, ai_report = ?, ai_source = ?, finished_at = NOW(), updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
            [
                toJsonText(questionList, []),
                report.totalScore,
                toJsonText(report, {}),
                source,
                req.params.id
            ]
        );

        res.json({
            success: true,
            source,
            report,
            session: await getSessionPayload(req.params.id)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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
        const [sessions] = await db.promise().query(
            'SELECT * FROM interview_sessions WHERE user_id = ? ORDER BY updated_at DESC, started_at DESC',
            [req.params.userId]
        );
        const sessionIds = sessions.map((item) => item.id);
        let turns = [];
        if (sessionIds.length) {
            const [turnRows] = await db.promise().query(
                `SELECT * FROM interview_turns WHERE session_id IN (${sessionIds.map(() => '?').join(',')}) ORDER BY session_id ASC, question_index ASC`,
                sessionIds
            );
            turns = turnRows;
        }
        const sessionRecords = sessions.map((session) => serializeSessionRow(
            session,
            turns.filter((turn) => turn.session_id === session.id)
        ));

        const [legacyRecords] = await db.promise().query(
            'SELECT * FROM interview_records WHERE user_id = ? ORDER BY created_at DESC',
            [req.params.userId]
        );
        const normalizedLegacy = legacyRecords.map((record) => ({
            ...record,
            id: `record-${record.id}`,
            recordId: record.id,
            source_type: 'record'
        }));
        res.json([...sessionRecords, ...normalizedLegacy].sort((a, b) => {
            const aTime = new Date(a.finished_at || a.updated_at || a.created_at).getTime();
            const bTime = new Date(b.finished_at || b.updated_at || b.created_at).getTime();
            return bTime - aTime;
        }));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = Number(process.env.PORT || 3000);
ensureInterviewSessionTables()
    .then(ensureJobTemplateTables)
    .catch((error) => {
        console.warn('Interview/session template table initialization skipped:', error.message);
    })
    .finally(() => {
        app.listen(PORT, () => {
            console.log(`职引官后端服务运行在 http://localhost:${PORT}`);
        });
    });
