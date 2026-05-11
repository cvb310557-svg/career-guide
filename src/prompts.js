const INTERVIEWERS = {
    leo: {
        id: 'leo',
        name: 'Leo Owen',
        style: '热情活跃型',
        behavior: '语气积极、鼓励表达、善于追问经历细节，适合帮助候选人打开思路。'
    },
    doria: {
        id: 'doria',
        name: 'Doria Flora',
        style: '温柔和蔼型',
        behavior: '语气温和、耐心引导、降低紧张感，适合初次面试训练和基础表达打磨。'
    },
    kelly: {
        id: 'kelly',
        name: 'Kelly Amy',
        style: '笑里藏刀型',
        behavior: '表面亲和但追问精准，会抓住回答漏洞和简历细节继续深挖。'
    },
    jackson: {
        id: 'jackson',
        name: 'Jackson',
        style: '压力挑战型',
        behavior: '问题直接、节奏较快、追问有压迫感，用于训练抗压能力和临场应变。'
    },
    jessica: {
        id: 'jessica',
        name: 'Jessica Vivian',
        style: '严肃专业型',
        behavior: '表达正式、问题紧扣岗位专业能力和业务场景，重视逻辑、证据和严谨性。'
    }
};

function getInterviewerProfile(id) {
    return INTERVIEWERS[id] || INTERVIEWERS.leo;
}

function buildQuestionMessages({
    position,
    company,
    jd,
    interviewer,
    knowledgeContext,
    questionCount = 6
}) {
    return [
        {
            role: 'system',
            content: [
                '你是“职引官”AI面试规划与实战提升平台的专业面试官。',
                '你的任务是基于岗位JD、真实面经资料和面试官风格，生成高仿真的中文模拟面试题。',
                '必须只输出 JSON，不要输出 Markdown。',
                '问题要具体、岗位化、可回答，避免空泛鸡汤。',
                '不要生成违法、歧视、侮辱或过度侵犯隐私的问题。'
            ].join('\n')
        },
        {
            role: 'user',
            content: [
                `岗位: ${position || '未填写'}`,
                `公司/场景: ${company || '通用场景'}`,
                `目标题目数量: ${questionCount}`,
                `面试官: ${interviewer.name}（${interviewer.style}）`,
                `面试官风格要求: ${interviewer.behavior}`,
                '',
                '岗位JD:',
                jd || '用户未提供JD，请根据岗位通用要求生成。',
                '',
                '可参考知识库资料:',
                knowledgeContext || '暂无知识库命中资料。',
                '',
                '请输出如下 JSON 结构:',
                JSON.stringify({
                    profile: {
                        roleFocus: ['岗位关注点1', '岗位关注点2'],
                        abilityTags: ['能力标签1', '能力标签2'],
                        difficulty: '基础/中等/偏难'
                    },
                    questions: [
                        '问题1',
                        '问题2'
                    ]
                }, null, 2)
            ].join('\n')
        }
    ];
}

function buildFollowupMessages({
    position,
    company,
    interviewer,
    question,
    answer,
    previousQuestions = []
}) {
    return [
        {
            role: 'system',
            content: [
                '你是“职引官”的AI面试官，负责根据候选人回答生成一条追问。',
                '只输出 JSON，不要输出 Markdown。',
                '追问必须围绕岗位能力、项目细节、结果证据或STAR结构展开。',
                '不要重复已经问过的问题。'
            ].join('\n')
        },
        {
            role: 'user',
            content: [
                `岗位: ${position || '目标岗位'}`,
                `公司/场景: ${company || '通用场景'}`,
                `面试官: ${interviewer.name}（${interviewer.style}）`,
                `风格要求: ${interviewer.behavior}`,
                '',
                '已问过的问题:',
                previousQuestions.join('\n') || '无',
                '',
                `当前问题: ${question}`,
                `候选人回答: ${answer}`,
                '',
                '请输出 JSON: {"followup":"一条中文追问"}'
            ].join('\n')
        }
    ];
}

function buildReportMessages({
    type,
    position,
    company,
    jd,
    interviewer,
    questions,
    answers,
    knowledgeContext
}) {
    const qaText = questions.map((question, index) => {
        return `Q${index + 1}: ${question}\nA${index + 1}: ${answers[index] || '未作答'}`;
    }).join('\n\n');

    return [
        {
            role: 'system',
            content: [
                '你是“职引官”AI面试复盘教练，负责生成专业、具体、可执行的中文面试报告。',
                '必须只输出 JSON，不要输出 Markdown。',
                '评分要严格但建设性，不能只根据回答长度打分。',
                '所有建议都要面向求职训练，避免做心理诊断、性格判定或敏感推断。'
            ].join('\n')
        },
        {
            role: 'user',
            content: [
                `面试类型: ${type || position || 'AI模拟面试'}`,
                `岗位: ${position || type || '未填写'}`,
                `公司/场景: ${company || '通用场景'}`,
                `面试官: ${interviewer.name}（${interviewer.style}）`,
                `面试官风格: ${interviewer.behavior}`,
                '',
                '岗位JD:',
                jd || '用户未提供JD。',
                '',
                '知识库参考:',
                knowledgeContext || '暂无资料。',
                '',
                '问答记录:',
                qaText,
                '',
                '请输出如下 JSON 结构，分数范围都是 0-100:',
                JSON.stringify({
                    totalScore: 82,
                    dimensions: {
                        jobFit: 80,
                        professional: 85,
                        logic: 78,
                        star: 76,
                        adaptability: 82,
                        communication: 84
                    },
                    summary: '总体评价',
                    strengths: ['优势1', '优势2'],
                    weaknesses: ['短板1', '短板2'],
                    questionReviews: [
                        {
                            question: '原问题',
                            answer: '候选人回答摘要',
                            score: 80,
                            strengths: ['本题亮点'],
                            problems: ['本题问题'],
                            optimizedAnswer: '优化后的回答思路，不要编造不存在的经历',
                            followupSuggestion: '建议下一步追问'
                        }
                    ],
                    trainingPlan: ['训练建议1', '训练建议2'],
                    recommendedResources: ['推荐资料1', '推荐资料2']
                }, null, 2)
            ].join('\n')
        }
    ];
}

module.exports = {
    INTERVIEWERS,
    getInterviewerProfile,
    buildQuestionMessages,
    buildFollowupMessages,
    buildReportMessages
};
