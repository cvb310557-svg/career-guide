// server.js - 职引官完整版后端
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ==================== 数据库配置 ====================
const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'zhiguanguan',
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10
});

// ==================== 用户API ====================

// 注册
app.post('/api/register', async (req, res) => {
    const { username, password, nickname } = req.body;
    
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

// 登录
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

// 获取用户积分
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

// ==================== 知识库API ====================

// 获取所有知识库
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

// 按岗位搜索
app.get('/api/knowledge/search/:keyword', async (req, res) => {
    try {
        const keyword = `%${req.params.keyword}%`;
        const [rows] = await db.promise().query(
            'SELECT * FROM knowledge_base WHERE position LIKE ? OR company LIKE ? OR interview_questions LIKE ?',
            [keyword, keyword, keyword]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取单个知识库
app.get('/api/knowledge/:id', async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            'SELECT * FROM knowledge_base WHERE id = ?',
            [req.params.id]
        );
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== 论坛API ====================

// 获取所有帖子
app.get('/api/forum/posts', async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            `SELECT p.*, u.nickname as author_name,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as reply_count
            FROM forum_posts p
            LEFT JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建帖子（得积分）
app.post('/api/forum/post', async (req, res) => {
    const { userId, title, content } = req.body;

    try {
        const [result] = await db.promise().query(
            'INSERT INTO forum_posts (user_id, title, content) VALUES (?, ?, ?)',
            [userId, title, content]
        );
        
        // 发帖得10积分
        await db.promise().query(
            'UPDATE users SET points = points + 10 WHERE id = ?',
            [userId]
        );
        
        res.json({ success: true, id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取帖子详情
app.get('/api/forum/post/:id', async (req, res) => {
    try {
        const [post] = await db.promise().query(
            `SELECT p.*, u.nickname as author_name
            FROM forum_posts p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.id = ?`,
            [req.params.id]
        );

        const [comments] = await db.promise().query(
            `SELECT c.*, u.nickname as user_name
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.id
            WHERE c.post_id = ?
            ORDER BY c.created_at ASC`,
            [req.params.id]
        );

        res.json({ ...post[0], comments });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 添加评论（得积分）
app.post('/api/forum/post/:id/comment', async (req, res) => {
    const { userId, content } = req.body;
    const postId = req.params.id;

    try {
        await db.promise().query(
            'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
            [postId, userId, content]
        );
        
        // 评论得5积分
        await db.promise().query(
            'UPDATE users SET points = points + 5 WHERE id = ?',
            [userId]
        );
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== 导师API ====================

// 获取所有导师
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

// 获取导师详情
app.get('/api/mentors/:id', async (req, res) => {
    try {
        const [rows] = await db.promise().query(
            'SELECT * FROM mentors WHERE id = ?',
            [req.params.id]
        );
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 创建预约
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

// ==================== AI面试记录 ====================

// 保存面试记录
app.post('/api/interview/save', async (req, res) => {
    const { userId, type, questions, answers, score } = req.body;

    try {
        await db.promise().query(
            'INSERT INTO interview_records (user_id, type, questions, answers, score) VALUES (?, ?, ?, ?, ?)',
            [userId, type, JSON.stringify(questions), JSON.stringify(answers), score]
        );
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取用户面试记录
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

// 启动服务器
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
    console.log(`✅ 后端服务运行在 http://localhost:${PORT}`);
});
