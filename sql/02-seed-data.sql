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

-- 插入按钮权限（type=2）并关联到对应菜单
INSERT INTO permission (parent_id, name, code, type, resource, action, sort_order, created_by, created_at) VALUES
-- 作品管理下的按钮
(@menu_novels, '新建作品',        'novel:create',         2, 'novel',  'create', 1,  1, NOW()),
(@menu_novels, '读取作品',        'novel:read',           2, 'novel',  'read',   2,  1, NOW()),
(@menu_novels, '修改作品',        'novel:update',         2, 'novel',  'update', 3,  1, NOW()),
(@menu_novels, '删除作品',        'novel:delete',         2, 'novel',  'delete', 4,  1, NOW()),
(@menu_novels, '设置作品可见角色', 'novel:set_visibility', 2, 'novel',  'manage', 5,  1, NOW()),
(@menu_novels, '查看节点',        'node:read',            2, 'node',   'read',   6,  1, NOW()),
(@menu_novels, '新建节点',        'node:create',          2, 'node',   'create', 7,  1, NOW()),
(@menu_novels, '编辑节点',        'node:update',          2, 'node',   'update', 8,  1, NOW()),
(@menu_novels, '删除节点',        'node:delete',          2, 'node',   'delete', 9,  1, NOW()),
(@menu_novels, '查看事件',        'event:read',           2, 'event',  'read',   10, 1, NOW()),
(@menu_novels, '新建事件',        'event:create',         2, 'event',  'create', 11, 1, NOW()),
(@menu_novels, '编辑事件',        'event:update',         2, 'event',  'update', 12, 1, NOW()),
(@menu_novels, '删除事件',        'event:delete',         2, 'event',  'delete', 13, 1, NOW()),
-- 用户管理下的按钮
(@menu_users, '查看用户列表',     'user:read',            2, 'user',   'read',   1,  1, NOW()),
(@menu_users, '修改用户角色',     'user:update_role',     2, 'user',   'update', 2,  1, NOW()),
(@menu_users, '启用/禁用用户',    'user:disable',         2, 'user',   'manage', 3,  1, NOW()),
-- 角色管理下的按钮
(@menu_roles, '查看角色列表',     'role:read',            2, 'role',   'read',   1,  1, NOW()),
(@menu_roles, '管理角色',        'role:manage',          2, 'role',   'manage', 2,  1, NOW()),
-- 游玩端下的按钮
(@menu_player, '游玩作品',       'player:play',          2, 'player', 'read',   1,  1, NOW()),
(@menu_player, '存档读档',       'player:save',          2, 'player', 'create', 2,  1, NOW()),
(@menu_player, '转盘抽奖',       'player:spin',          2, 'player', 'create', 3,  1, NOW());

-- ---- 3. 角色-权限映射 ----
-- ADMIN: 全部权限
INSERT INTO role_permission (role_id, permission_id)
SELECT (SELECT id FROM role WHERE code = 'ADMIN'), id FROM permission;

-- EDITOR
INSERT INTO role_permission (role_id, permission_id)
SELECT (SELECT id FROM role WHERE code = 'EDITOR'), id FROM permission
WHERE code IN (
    'novel:read', 'novel:update',
    'node:read', 'node:create', 'node:update', 'node:delete',
    'event:read', 'event:create', 'event:update', 'event:delete',
    'role:read'
);

-- USER
INSERT INTO role_permission (role_id, permission_id)
SELECT (SELECT id FROM role WHERE code = 'USER'), id FROM permission
WHERE code IN (
    'novel:read', 'node:read', 'event:read',
    'player:play', 'player:save', 'player:spin'
);

-- GUEST
INSERT INTO role_permission (role_id, permission_id)
SELECT (SELECT id FROM role WHERE code = 'GUEST'), id FROM permission
WHERE code IN (
    'novel:read', 'node:read', 'event:read',
    'player:play', 'player:save', 'player:spin'
);

-- ---- 4. 默认管理员账号 ----
-- 密码: admin123（BCrypt 加密）
INSERT INTO user (username, password, nickname, is_enabled, created_at, updated_at) VALUES
('admin', '$2a$10$mCFwBlKYAIuazd4YFJfpieDekEa2RMCcFzu65C3oit7L5wDTu7z4G', '管理员', TRUE, NOW(), NOW());

-- 分配 ADMIN 角色
INSERT INTO user_role (user_id, role_id)
SELECT (SELECT id FROM user WHERE username = 'admin'), (SELECT id FROM role WHERE code = 'ADMIN');
