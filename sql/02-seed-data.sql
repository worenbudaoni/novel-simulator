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
INSERT INTO permission (code, name, resource, action, created_at) VALUES
-- novel
('novel:create',          '新建作品',         'novel', 'create', NOW()),
('novel:read',            '读取作品',         'novel', 'read',   NOW()),
('novel:update',          '修改作品',         'novel', 'update', NOW()),
('novel:delete',          '删除作品',         'novel', 'delete', NOW()),
('novel:set_visibility',  '设置作品可见角色',  'novel', 'manage', NOW()),
-- node
('node:read',             '查看节点',         'node',  'read',   NOW()),
('node:create',           '新建节点',         'node',  'create', NOW()),
('node:update',           '编辑节点',         'node',  'update', NOW()),
('node:delete',           '删除节点',         'node',  'delete', NOW()),
-- event
('event:read',            '查看事件',         'event', 'read',   NOW()),
('event:create',          '新建事件',         'event', 'create', NOW()),
('event:update',          '编辑事件',         'event', 'update', NOW()),
('event:delete',          '删除事件',         'event', 'delete', NOW()),
-- user
('user:read',             '查看用户列表',     'user',  'read',   NOW()),
('user:update_role',      '修改用户角色',     'user',  'update', NOW()),
('user:disable',          '启用/禁用用户',    'user',  'manage', NOW()),
-- role
('role:read',             '查看角色列表',     'role',  'read',   NOW()),
('role:manage',           '管理角色',         'role',  'manage', NOW()),
-- player
('player:play',           '游玩作品',         'player','read',   NOW()),
('player:save',           '存档读档',         'player','create', NOW()),
('player:spin',           '转盘抽奖',         'player','create', NOW());

-- ---- 3. 角色-权限映射 ----

-- ADMIN: 全部权限（通过编码配符匹配，实际开发中直接加载全部）
INSERT INTO role_permission (role_id, permission_id)
SELECT (SELECT id FROM role WHERE code = 'ADMIN'), id FROM permission;

-- EDITOR: novel:read, novel:update, node:*, event:*, role:read
INSERT INTO role_permission (role_id, permission_id)
SELECT (SELECT id FROM role WHERE code = 'EDITOR'), id FROM permission
WHERE code IN (
    'novel:read', 'novel:update',
    'node:read', 'node:create', 'node:update', 'node:delete',
    'event:read', 'event:create', 'event:update', 'event:delete',
    'role:read'
);

-- USER: novel:read, node:read, event:read, player:play, player:save, player:spin
INSERT INTO role_permission (role_id, permission_id)
SELECT (SELECT id FROM role WHERE code = 'USER'), id FROM permission
WHERE code IN (
    'novel:read', 'node:read', 'event:read',
    'player:play', 'player:save', 'player:spin'
);

-- GUEST: novel:read, node:read, event:read, player:play, player:save, player:spin
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
