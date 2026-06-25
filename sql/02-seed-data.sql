-- ============================================================
-- Novel Interactive Story Simulator — 初始数据
-- 文件: sql/02-seed-data.sql
-- 说明: 预设角色、权限、角色-权限映射、默认管理员账号
-- ============================================================

-- ---- 1. 预设角色 ----
INSERT INTO role (code, name, description, is_system, created_at) VALUES
('ADMIN',  '管理员',   '系统管理员，拥有全部权限',              TRUE,  NOW()),
('EDITOR', '编辑',     '内容编辑，可管理作品/节点/事件',         TRUE,  NOW()),
('USER',   '用户',     '普通注册用户，可游玩和存档',            TRUE,  NOW()),
('GUEST',  '游客',     '未登录用户，仅限公开作品',              TRUE,  NOW());

-- ---- 2. 预设权限 ----

-- 清空旧数据（注意外键顺序）
DELETE FROM role_permission;
DELETE FROM permission;

-- 插入菜单节点（type=1）
INSERT INTO permission (parent_id, name, code, type, route, sort_order, created_by, created_at) VALUES
(0, '系统管理',   'menu:admin',       1, '/admin',          1, 1, NOW()),
(1, '作品管理',   'menu:novels',      1, '/admin',          2, 1, NOW()),
(1, '用户管理',   'menu:users',       1, '/admin/users',    3, 1, NOW()),
(1, '角色管理',   'menu:roles',       1, '/admin/roles',    4, 1, NOW()),
(1, '权限管理',   'menu:permissions', 1, '/admin/permissions', 5, 1, NOW()),
(1, 'Prompt 配置', 'menu:prompts',    1, '/admin',          6, 1, NOW()),
(0, '游玩端',     'menu:player',      1, '/player',         7, 1, NOW());

-- 用变量记录菜单ID
SET @menu_admin = (SELECT id FROM permission WHERE code = 'menu:admin');
SET @menu_novels = (SELECT id FROM permission WHERE code = 'menu:novels');
SET @menu_users = (SELECT id FROM permission WHERE code = 'menu:users');
SET @menu_roles = (SELECT id FROM permission WHERE code = 'menu:roles');
SET @menu_permissions = (SELECT id FROM permission WHERE code = 'menu:permissions');
SET @menu_prompts = (SELECT id FROM permission WHERE code = 'menu:prompts');
SET @menu_player = (SELECT id FROM permission WHERE code = 'menu:player');

-- 更新"作品管理"的子节点 parent_id
UPDATE permission SET parent_id = @menu_novels WHERE code IN (
    'novel:create', 'novel:read', 'novel:update', 'novel:delete', 'novel:set_visibility',
    'node:read', 'node:create', 'node:update', 'node:delete',
    'event:read', 'event:create', 'event:update', 'event:delete'
);

-- 更新"用户管理"的子节点
UPDATE permission SET parent_id = @menu_users, type = 2 WHERE code IN (
    'user:read', 'user:update_role', 'user:disable'
);

-- 更新"角色管理"的子节点
UPDATE permission SET parent_id = @menu_roles, type = 2 WHERE code IN (
    'role:read', 'role:manage'
);

-- 更新"游玩端"的子节点
UPDATE permission SET parent_id = @menu_player, type = 2 WHERE code IN (
    'player:play', 'player:save', 'player:spin'
);

-- 其他按钮权限（作品管理下的）type 也设为 2
UPDATE permission SET type = 2 WHERE code IN (
    'novel:create', 'novel:read', 'novel:update', 'novel:delete', 'novel:set_visibility',
    'node:read', 'node:create', 'node:update', 'node:delete',
    'event:read', 'event:create', 'event:update', 'event:delete'
);

-- 保留的旧字段 resource/action 不动

-- ---- 3. 角色-权限映射 ----

-- ---- 4. 默认管理员账号 ----
-- 密码: admin123（BCrypt 加密）
INSERT INTO user (username, password, nickname, is_enabled, created_at, updated_at) VALUES
('admin', '$2a$10$mCFwBlKYAIuazd4YFJfpieDekEa2RMCcFzu65C3oit7L5wDTu7z4G', '管理员', TRUE, NOW(), NOW());

-- 分配 ADMIN 角色
INSERT INTO user_role (user_id, role_id)
SELECT (SELECT id FROM user WHERE username = 'admin'), (SELECT id FROM role WHERE code = 'ADMIN');
