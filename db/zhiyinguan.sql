CREATE DATABASE IF NOT EXISTS zhiguanguan
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE zhiguanguan;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  nickname VARCHAR(80) NOT NULL,
  points INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS knowledge_base (
  id INT AUTO_INCREMENT PRIMARY KEY,
  position VARCHAR(120) NOT NULL,
  company VARCHAR(120) DEFAULT NULL,
  experience_type VARCHAR(60) DEFAULT '面经',
  interview_questions LONGTEXT,
  content LONGTEXT,
  tags VARCHAR(500) DEFAULT NULL,
  source_url VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS forum_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  title VARCHAR(200) NOT NULL,
  content LONGTEXT NOT NULL,
  category VARCHAR(40) DEFAULT '面经',
  likes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_forum_posts_user_id (user_id),
  CONSTRAINT fk_forum_posts_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT DEFAULT NULL,
  content LONGTEXT NOT NULL,
  likes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_comments_post_id (post_id),
  INDEX idx_comments_user_id (user_id),
  CONSTRAINT fk_comments_post
    FOREIGN KEY (post_id) REFERENCES forum_posts(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_comments_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mentors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  company VARCHAR(120) DEFAULT NULL,
  position VARCHAR(120) DEFAULT NULL,
  experience VARCHAR(80) DEFAULT NULL,
  rating DECIMAL(3,2) NOT NULL DEFAULT 5.00,
  price DECIMAL(10,2) DEFAULT 199.00,
  tags VARCHAR(500) DEFAULT NULL,
  avatar_url VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  mentor_id INT DEFAULT NULL,
  type VARCHAR(80) NOT NULL,
  booking_time DATETIME NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT '待确认',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bookings_user_id (user_id),
  INDEX idx_bookings_mentor_id (mentor_id),
  CONSTRAINT fk_bookings_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_bookings_mentor
    FOREIGN KEY (mentor_id) REFERENCES mentors(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS resumes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  file_name VARCHAR(255) DEFAULT NULL,
  source_type VARCHAR(40) NOT NULL DEFAULT 'text',
  target_position VARCHAR(120) DEFAULT NULL,
  raw_text LONGTEXT NOT NULL,
  summary_json LONGTEXT,
  summary_text LONGTEXT,
  parse_source VARCHAR(40) NOT NULL DEFAULT 'fallback',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_resumes_user_id (user_id),
  CONSTRAINT fk_resumes_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS interview_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  type VARCHAR(120) NOT NULL,
  position VARCHAR(120) DEFAULT NULL,
  company VARCHAR(120) DEFAULT NULL,
  interviewer_id VARCHAR(40) DEFAULT NULL,
  jd_text LONGTEXT,
  questions LONGTEXT NOT NULL,
  answers LONGTEXT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  ai_report LONGTEXT,
  metadata LONGTEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_interview_records_user_id (user_id),
  CONSTRAINT fk_interview_records_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO knowledge_base (position, company, experience_type, interview_questions, content, tags)
SELECT '产品经理', '字节跳动', '面经',
'请做一个自我介绍，并突出你和产品经理岗位相关的经历。
请分析一款你常用的产品，它的核心用户是谁？
如果某功能上线后次日留存下降，你会如何定位问题？
请讲一个你推动跨部门协作的经历。
你如何判断一个需求是否值得做？',
'产品经理岗位通常关注用户洞察、需求分析、数据意识、跨部门沟通和项目推进能力。',
'互联网,产品经理,用户研究,数据分析,需求分析'
WHERE NOT EXISTS (SELECT 1 FROM knowledge_base WHERE position = '产品经理' AND company = '字节跳动');

INSERT INTO knowledge_base (position, company, experience_type, interview_questions, content, tags)
SELECT '金融数据分析', '金融机构', '题库',
'请介绍一个你做过的数据分析项目。
SQL 中窗口函数适合解决什么问题？请举例。
如果业务方认为你的数据结论不符合直觉，你会如何沟通？
请解释估值模型中核心假设对结果的影响。
如何识别数据异常并判断是否需要剔除？',
'金融数据分析岗位关注 SQL、Python、统计分析、金融建模、风险意识和业务解释能力。',
'金融,数据分析,SQL,Python,估值模型,风险控制'
WHERE NOT EXISTS (SELECT 1 FROM knowledge_base WHERE position = '金融数据分析' AND company = '金融机构');

INSERT INTO knowledge_base (position, company, experience_type, interview_questions, content, tags)
SELECT 'Java开发', '阿里巴巴', '面经',
'请介绍你最熟悉的一个后端项目。
HashMap 的扩容机制是什么？
JVM 内存区域如何划分？
如何排查线上接口响应变慢？
你如何保证接口的并发安全？',
'Java 开发岗位关注基础原理、工程实践、性能排查、并发控制和项目落地能力。',
'技术,Java,后端,JVM,并发,性能优化'
WHERE NOT EXISTS (SELECT 1 FROM knowledge_base WHERE position = 'Java开发' AND company = '阿里巴巴');

INSERT INTO job_templates (name, industry, ability_model, common_questions, keywords, training_advice, popularity)
SELECT '产品经理', '互联网',
'["用户洞察","需求分析","数据判断","跨部门推进","商业理解"]',
'["请分析一款你常用产品的核心用户、使用场景和增长机会。","如果核心功能上线后留存下降，你会如何定位原因并推进优化？","请讲一个你推动跨部门协作并落地需求的经历。","你如何判断一个需求是否值得做？会看哪些数据和用户反馈？","如果研发资源不足但业务方强烈要求上线，你会如何取舍？"]',
'["产品经理","用户研究","需求分析","数据分析","A/B测试","用户增长","原型","PRD"]',
'["准备一个完整产品分析案例","用 STAR 复盘跨部门项目","练习用数据解释需求优先级"]',
100
WHERE NOT EXISTS (SELECT 1 FROM job_templates WHERE name = '产品经理' AND industry = '互联网');

INSERT INTO job_templates (name, industry, ability_model, common_questions, keywords, training_advice, popularity)
SELECT 'Java开发', '互联网技术',
'["Java基础","JVM","并发编程","数据库","系统设计","线上排障"]',
'["请介绍你最熟悉的一个后端项目，以及你负责的核心模块。","HashMap 的扩容机制和线程安全风险是什么？","JVM 内存区域如何划分？线上 OOM 你会如何排查？","如何设计一个高并发接口，并保证数据一致性？","请讲一次你定位接口响应变慢或线上故障的经历。"]',
'["Java","Spring","Spring Boot","JVM","MySQL","Redis","并发","微服务","性能优化"]',
'["复盘一个能讲清架构取舍的项目","准备 JVM/并发/数据库高频题","补充线上排障的指标和工具链"]',
100
WHERE NOT EXISTS (SELECT 1 FROM job_templates WHERE name = 'Java开发' AND industry = '互联网技术');

INSERT INTO job_templates (name, industry, ability_model, common_questions, keywords, training_advice, popularity)
SELECT '金融数据分析', '金融',
'["SQL","Python","统计分析","金融业务理解","风险意识","可视化表达"]',
'["请介绍一个你做过的数据分析项目，包括目标、方法和结论。","SQL 窗口函数适合解决什么问题？请举例。","如果业务方认为你的数据结论不符合直觉，你会如何沟通？","估值模型中的核心假设会如何影响结果？","如何识别数据异常，并判断是否需要剔除？"]',
'["金融","数据分析","SQL","Python","Excel","估值模型","风控","可视化","统计"]',
'["准备一段从数据到业务建议的完整案例","练习 SQL 高频分析题","补充金融指标和风险解释能力"]',
100
WHERE NOT EXISTS (SELECT 1 FROM job_templates WHERE name = '金融数据分析' AND industry = '金融');

INSERT INTO mentors (name, company, position, experience, rating, price, tags)
SELECT '赵老师', '腾讯', '产品策划', '3年', 4.90, 199.00, '产品经理,简历优化,模拟面试'
WHERE NOT EXISTS (SELECT 1 FROM mentors WHERE name = '赵老师');

INSERT INTO mentors (name, company, position, experience, rating, price, tags)
SELECT '钱工', '阿里', 'Java架构师', '8年', 5.00, 299.00, 'Java,后端开发,技术面'
WHERE NOT EXISTS (SELECT 1 FROM mentors WHERE name = '钱工');
