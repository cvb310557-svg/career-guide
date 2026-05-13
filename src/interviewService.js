const { toArray, toJsonText, clampScore, parseJsonResponseSafe } = require('./utils');

function createInterviewService({ db, getInterviewerProfile }) {
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

    async function ensureInterviewSessionTables() {
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS interview_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT DEFAULT NULL,
                type VARCHAR(120) DEFAULT 'AI面试',
                position VARCHAR(120) DEFAULT NULL,
                company VARCHAR(120) DEFAULT NULL,
                interviewer_id VARCHAR(40) DEFAULT NULL,
                jd_text LONGTEXT,
                template_id INT DEFAULT NULL,
                template_summary LONGTEXT,
                resume_id INT DEFAULT NULL,
                resume_summary LONGTEXT,
                questions LONGTEXT NOT NULL,
                status VARCHAR(40) NOT NULL DEFAULT 'in_progress',
                total_score INT DEFAULT NULL,
                ai_report LONGTEXT,
                ai_source VARCHAR(40) DEFAULT NULL,
                started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                finished_at DATETIME DEFAULT NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_interview_sessions_user_id (user_id),
                INDEX idx_interview_sessions_status (status),
                CONSTRAINT fk_interview_sessions_user
                    FOREIGN KEY (user_id) REFERENCES users(id)
                    ON DELETE SET NULL,
                CONSTRAINT fk_interview_sessions_resume
                    FOREIGN KEY (resume_id) REFERENCES resumes(id)
                    ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await ensureColumn('interview_sessions', 'position', 'VARCHAR(120) DEFAULT NULL');
        await ensureColumn('interview_sessions', 'company', 'VARCHAR(120) DEFAULT NULL');
        await ensureColumn('interview_sessions', 'interviewer_id', 'VARCHAR(40) DEFAULT NULL');
        await ensureColumn('interview_sessions', 'jd_text', 'LONGTEXT');
        await ensureColumn('interview_sessions', 'template_id', 'INT DEFAULT NULL');
        await ensureColumn('interview_sessions', 'template_summary', 'LONGTEXT');
        await ensureColumn('interview_sessions', 'resume_id', 'INT DEFAULT NULL');
        await ensureColumn('interview_sessions', 'resume_summary', 'LONGTEXT');
        await ensureColumn('interview_sessions', 'total_score', 'INT DEFAULT NULL');
        await ensureColumn('interview_sessions', 'ai_report', 'LONGTEXT');
        await ensureColumn('interview_sessions', 'ai_source', 'VARCHAR(40) DEFAULT NULL');
        await ensureColumn('interview_sessions', 'finished_at', 'DATETIME DEFAULT NULL');

        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS interview_turns (
                id INT AUTO_INCREMENT PRIMARY KEY,
                session_id INT NOT NULL,
                question_index INT NOT NULL,
                question LONGTEXT NOT NULL,
                answer LONGTEXT,
                kind VARCHAR(40) NOT NULL DEFAULT 'base',
                ai_source VARCHAR(40) DEFAULT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_interview_turns_session_question (session_id, question_index),
                INDEX idx_interview_turns_session_id (session_id),
                CONSTRAINT fk_interview_turns_session
                    FOREIGN KEY (session_id) REFERENCES interview_sessions(id)
                    ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await ensureColumn('interview_turns', 'kind', "VARCHAR(40) NOT NULL DEFAULT 'base'");
        await ensureColumn('interview_turns', 'ai_source', 'VARCHAR(40) DEFAULT NULL');
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

    function serializeSessionRow(row, turns = []) {
        const sortedTurns = turns.slice().sort((a, b) => a.question_index - b.question_index);
        const turnQuestions = sortedTurns.map((turn) => turn.question);
        const sessionQuestions = toArray(row.questions);
        const questions = sessionQuestions.length ? sessionQuestions : turnQuestions;
        const answers = questions.map((_, index) => sortedTurns.find((turn) => turn.question_index === index)?.answer || '');

        return {
            id: `session-${row.id}`,
            sessionId: row.id,
            source_type: 'session',
            user_id: row.user_id,
            type: row.type || row.position || 'AI面试',
            position: row.position,
            company: row.company,
            interviewer_id: row.interviewer_id,
            jd_text: row.jd_text,
            template_id: row.template_id || null,
            template_summary: parseJsonResponseSafe(row.template_summary, null),
            resume_id: row.resume_id,
            resume_summary: row.resume_summary,
            questions,
            answers,
            turns: sortedTurns.map((turn) => ({
                id: turn.id,
                sessionId: turn.session_id,
                questionIndex: turn.question_index,
                question: turn.question,
                answer: turn.answer || '',
                kind: turn.kind || 'base',
                aiSource: turn.ai_source || null,
                created_at: turn.created_at,
                updated_at: turn.updated_at
            })),
            status: row.status,
            score: row.total_score,
            ai_report: parseJsonResponseSafe(row.ai_report, null),
            ai_source: row.ai_source,
            created_at: row.started_at,
            started_at: row.started_at,
            finished_at: row.finished_at,
            updated_at: row.updated_at,
            metadata: {
                resumeId: row.resume_id || null,
                resumeSummary: row.resume_summary || null,
                templateId: row.template_id || null,
                templateSummary: parseJsonResponseSafe(row.template_summary, null),
                sessionId: row.id
            }
        };
    }

    async function getSessionPayload(id) {
        const [rows] = await db.promise().query(
            'SELECT * FROM interview_sessions WHERE id = ? LIMIT 1',
            [id]
        );
        if (!rows[0]) return null;

        const [turns] = await db.promise().query(
            'SELECT * FROM interview_turns WHERE session_id = ? ORDER BY question_index ASC',
            [id]
        );

        return serializeSessionRow(rows[0], turns);
    }

    async function saveInterviewTurn(sessionId, payload) {
        const questionIndex = Number(payload.questionIndex ?? payload.question_index);
        if (!Number.isInteger(questionIndex) || questionIndex < 0) {
            throw new Error('缺少有效的问题序号');
        }
        if (!payload.question) {
            throw new Error('缺少问题内容');
        }

        await db.promise().query(
            `INSERT INTO interview_turns
            (session_id, question_index, question, answer, kind, ai_source)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                question = VALUES(question),
                answer = VALUES(answer),
                kind = VALUES(kind),
                ai_source = VALUES(ai_source)`,
            [
                sessionId,
                questionIndex,
                payload.question,
                payload.answer || '',
                payload.kind || 'base',
                payload.aiSource || payload.ai_source || null
            ]
        );

        await db.promise().query(
            'UPDATE interview_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [sessionId]
        );
    }

    return {
        ensureInterviewSessionTables,
        queryKnowledge,
        saveInterviewRecord,
        serializeSessionRow,
        getSessionPayload,
        saveInterviewTurn
    };
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

function fallbackQuestions({ position, company, jd, interviewerId, questionCount = 6, getInterviewerProfile }) {
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
        jobFit: clampScore(average + 2, 65),
        professional: clampScore(average + 4, 65),
        logic: clampScore(average - 2, 65),
        star: clampScore(average - 4, 62),
        adaptability: clampScore(average, 65),
        communication: clampScore(average + 1, 65)
    };

    return {
        totalScore: average,
        dimensions,
        summary: average >= 80
            ? '整体表现较好，回答具备一定结构和岗位关联，可以继续强化细节证据。'
            : '当前回答还有明显提升空间，建议优先补充案例结构、量化结果和岗位关键词。',
        strengths: ['具备基础表达能力', '可以围绕岗位继续打磨案例'],
        weaknesses: ['回答中的量化成果和细节证据不足', 'STAR 结构还可以更稳定'],
        questionReviews: reviews,
        trainingPlan: ['每天练习 1 道行为面试题并按 STAR 复盘', '为核心项目补充背景、行动、结果和岗位关联', '准备 3 个可迁移到不同问题的代表性案例'],
        recommendedResources: ['岗位 JD 关键词清单', '项目复盘模板', 'STAR 行为面试回答框架']
    };
}

function normalizeReport(raw, fallbackInput) {
    const fallback = fallbackReport(fallbackInput);
    if (!raw || typeof raw !== 'object') return fallback;

    const dimensions = raw.dimensions || {};
    return {
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
}

module.exports = {
    createInterviewService,
    formatKnowledgeContext,
    fallbackQuestions,
    fallbackReport,
    normalizeReport
};
