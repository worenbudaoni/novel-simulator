-- ============================================================
-- Novel Interactive Story Simulator — DDL
-- 文件: sql/01-ddl.sql
-- 说明: 全部 15 张表的建表语句
-- ============================================================

-- 1. 用户表
CREATE TABLE user (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    username    VARCHAR(50) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL COMMENT 'BCrypt 加密',
    nickname    VARCHAR(100),
    is_enabled  BOOLEAN DEFAULT TRUE,
    created_at  DATETIME,
    updated_at  DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. 角色表
CREATE TABLE role (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    code        VARCHAR(50) UNIQUE NOT NULL COMMENT '角色编码: ADMIN/USER/GUEST/EDITOR',
    name        VARCHAR(100) NOT NULL COMMENT '角色名称: 管理员/用户/游客/编辑',
    description VARCHAR(255),
    is_system   BOOLEAN DEFAULT FALSE COMMENT '是否系统预设（不可删除）',
    created_at  DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. 权限表
CREATE TABLE permission (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    parent_id   BIGINT DEFAULT 0 NOT NULL COMMENT '父级ID，0=根节点',
    name        VARCHAR(100) NOT NULL COMMENT '显示名称',
    code        VARCHAR(100) NOT NULL COMMENT '权限标识，全局唯一',
    resource    VARCHAR(50) DEFAULT NULL COMMENT '所属资源（渐变迁移中）',
    action      VARCHAR(50) DEFAULT NULL COMMENT '操作（渐变迁移中）',
    type        TINYINT NOT NULL DEFAULT 1 COMMENT '1=菜单 2=按钮',
    route       VARCHAR(200) DEFAULT NULL COMMENT '前端路由（仅菜单）',
    status      TINYINT DEFAULT 1 COMMENT '1=有效 0=无效',
    sort_order  INT DEFAULT 0 COMMENT '排序号',
    created_by  BIGINT DEFAULT 0 NOT NULL COMMENT '创建人（逻辑外键）',
    created_at  DATETIME COMMENT '创建时间',
    updated_at  DATETIME COMMENT '修改时间',
    UNIQUE KEY uk_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权限表（树形RBAC）';

-- 4. 用户-角色关联表
CREATE TABLE user_role (
    id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id  BIGINT NOT NULL,
    role_id  BIGINT NOT NULL,
    UNIQUE KEY uk_user_role (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES user(id),
    FOREIGN KEY (role_id) REFERENCES role(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. 角色-权限关联表
CREATE TABLE role_permission (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    role_id       BIGINT NOT NULL,
    permission_id BIGINT NOT NULL,
    UNIQUE KEY uk_role_permission (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES role(id),
    FOREIGN KEY (permission_id) REFERENCES permission(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. 小说表
CREATE TABLE novel (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(100) NOT NULL COMMENT '作品名称',
    author      VARCHAR(100) COMMENT '原作者',
    world_view  TEXT COMMENT '世界观设定（结构化文本）',
    content_type TINYINT DEFAULT 0 COMMENT '0=小说 1=动漫 2=漫画',
    source_type  TINYINT DEFAULT 0 COMMENT '0=TXT上传 1=联网搜索',
    raw_content  LONGTEXT COMMENT '原始文本（TXT导入时）',
    cover_url    VARCHAR(500),
    status       TINYINT DEFAULT 0 COMMENT '0=草稿 1=已发布',
    parse_status TINYINT DEFAULT 0 COMMENT '0=未解析 1=解析中 2=已完成',
    parsed_at    DATETIME COMMENT '最近解析时间',
    created_by   BIGINT COMMENT '创建者',
    created_at   DATETIME,
    updated_at   DATETIME,
    FOREIGN KEY (created_by) REFERENCES user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. 作品-角色可见性表
CREATE TABLE novel_role_visibility (
    id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    novel_id BIGINT NOT NULL,
    role_id  BIGINT NOT NULL,
    UNIQUE KEY uk_novel_role (novel_id, role_id),
    FOREIGN KEY (novel_id) REFERENCES novel(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES role(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. 核心节点表
CREATE TABLE node (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    novel_id    BIGINT NOT NULL,
    title       VARCHAR(200) NOT NULL COMMENT '节点名称',
    description TEXT COMMENT '节点描述/场景介绍',
    node_type   TINYINT DEFAULT 0 COMMENT '0=核心节点 1=LLM动态生成',
    is_start    BOOLEAN DEFAULT FALSE COMMENT '是否起始节点',
    is_end      BOOLEAN DEFAULT FALSE COMMENT '是否结局节点',
    min_intelligence INT DEFAULT 0 COMMENT '最小智力要求（0=不限制）',
    min_charm   INT DEFAULT 0 COMMENT '最小魅力要求（0=不限制）',
    required_title VARCHAR(100) COMMENT '需要称号解锁',
    sort_order  INT,
    created_at  DATETIME,
    FOREIGN KEY (novel_id) REFERENCES novel(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. 节点连接表
CREATE TABLE node_edge (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    novel_id        BIGINT NOT NULL,
    source_node_id  BIGINT NOT NULL,
    target_node_id  BIGINT NOT NULL,
    condition_desc  VARCHAR(500) COMMENT '解锁条件描述',
    edge_type       TINYINT DEFAULT 0 COMMENT '0=固定 1=条件解锁 2=随机解锁',
    FOREIGN KEY (novel_id) REFERENCES novel(id) ON DELETE CASCADE,
    FOREIGN KEY (source_node_id) REFERENCES node(id) ON DELETE CASCADE,
    FOREIGN KEY (target_node_id) REFERENCES node(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. 节点选项表
CREATE TABLE node_option (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    node_id         BIGINT NOT NULL,
    label           VARCHAR(200) NOT NULL COMMENT '选项文字',
    target_node_id  BIGINT COMMENT '指向节点（NULL=LLM动态生成）',
    trigger_event   BOOLEAN DEFAULT FALSE COMMENT '选择后是否触发随机事件',
    risk_hint       VARCHAR(200) COMMENT '风险提示',
    created_at      DATETIME,
    FOREIGN KEY (node_id) REFERENCES node(id) ON DELETE CASCADE,
    FOREIGN KEY (target_node_id) REFERENCES node(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. 随机事件表
CREATE TABLE random_event (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    novel_id    BIGINT NOT NULL,
    node_id     BIGINT COMMENT 'NULL=全局事件, 非NULL=节点专属',
    title       VARCHAR(200) NOT NULL,
    content     TEXT NOT NULL COMMENT '事件描述',
    event_type  TINYINT DEFAULT 0 COMMENT '0=正面 1=负面 2=中立',
    death_probability INT DEFAULT 0 COMMENT '额外死亡率（0-100）',
    attr_changes TEXT COMMENT '属性变化JSON: {"hp":-30,"attack":+5}',
    is_llm_gen  BOOLEAN DEFAULT FALSE COMMENT '是否LLM生成',
    weight      INT DEFAULT 10 COMMENT '随机权重',
    created_at  DATETIME,
    FOREIGN KEY (novel_id) REFERENCES novel(id) ON DELETE CASCADE,
    FOREIGN KEY (node_id) REFERENCES node(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. 用户存档表
CREATE TABLE user_session (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id      VARCHAR(64) UNIQUE NOT NULL COMMENT '游戏会话标识',
    user_id         BIGINT COMMENT '所属用户（NULL=游客）',
    novel_id        BIGINT NOT NULL,
    current_node_id BIGINT,
    history_path    TEXT COMMENT '走过的节点路径 JSON',
    story_text      LONGTEXT COMMENT '已生成的故事全文',
    story_summary   TEXT COMMENT '故事摘要',
    settings_json   TEXT COMMENT '用户设置（随机率/死亡率/LLM配置）',
    node_state_json TEXT COMMENT '节点状态JSON（已访问/锁定等）',
    last_save_at    DATETIME COMMENT '最近手动存档时间',
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      DATETIME,
    updated_at      DATETIME,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE SET NULL,
    FOREIGN KEY (novel_id) REFERENCES novel(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. 角色属性表
CREATE TABLE user_character (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id      VARCHAR(64) NOT NULL UNIQUE,
    hp              INT DEFAULT 100,
    attack          INT DEFAULT 10,
    defense         INT DEFAULT 10,
    intelligence    INT DEFAULT 50,
    charm           INT DEFAULT 50,
    luck            INT DEFAULT 50,
    current_title   VARCHAR(100) COMMENT '当前称号',
    titles_json     TEXT COMMENT '已获得称号列表 JSON',
    choices_made    INT DEFAULT 0,
    events_triggered INT DEFAULT 0,
    times_died      INT DEFAULT 0,
    final_score     INT COMMENT '最终分数',
    final_rank      VARCHAR(10) COMMENT '评级: SSS/S/A/B/C/D',
    rank_reason     TEXT COMMENT '评级理由（LLM生成）',
    updated_at      DATETIME,
    FOREIGN KEY (session_id) REFERENCES user_session(session_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. LLM 解析记录表
CREATE TABLE parse_record (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    novel_id      BIGINT NOT NULL,
    prompt_type   VARCHAR(50) NOT NULL COMMENT 'full_parse/reparse_nodes',
    input_summary VARCHAR(500),
    raw_response  LONGTEXT COMMENT 'LLM 原始返回',
    result_json   LONGTEXT COMMENT '解析后的结构化数据',
    tokens_used   INT COMMENT '消耗 tokens',
    status        TINYINT DEFAULT 0 COMMENT '0=成功 1=失败',
    created_at    DATETIME,
    FOREIGN KEY (novel_id) REFERENCES novel(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. LLM 生成缓存表
CREATE TABLE llm_cache (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    cache_key   VARCHAR(128) UNIQUE NOT NULL COMMENT '输入摘要哈希',
    prompt_type VARCHAR(50) NOT NULL COMMENT 'story/branch/event/parse',
    result_text LONGTEXT NOT NULL,
    created_at  DATETIME,
    expired_at  DATETIME COMMENT '过期时间',
    INDEX idx_expired_at (expired_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
