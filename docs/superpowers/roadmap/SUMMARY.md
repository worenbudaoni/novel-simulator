# Novel Interactive Story Simulator — 进度总览

> 总设计文档: `docs/superpowers/specs/2026-06-18-novel-interactive-story-simulator-design.md`
> 实施计划: `docs/superpowers/plans/2026-06-18-P1-基础架构.md`
> 最后更新: 2026-06-18

---

## 进度概况

| 阶段 | 状态 | 完成度 | 说明 |
|------|------|--------|------|
| **P1 基础架构** | ✅ **已完成** | **代码 100% / 数据库待执行** | 后端代码 + 前端脚手架全部完成，需建表后联调 |
| P2 内容管理 | ⏳ 待开始 | 0% | - |
| P3 核心玩法 | ⏳ 待开始 | 0% | - |
| P4 叙事与评分 | ⏳ 待开始 | 0% | - |
| P5 管理完善与移动端 | ⏳ 待开始 | 0% | - |

## 当前阶段

**当前阶段：** P1 基础架构 ✅

## P1 完成情况

### 后端（已完成）
| 任务 | 状态 | 说明 |
|-----|------|------|
| pom.xml 依赖 | ✅ | MyBatisPlus, Spring Security, Redis, LangChain4j, MySQL |
| 配置文件 | ✅ | application.yml, SecurityConfig, RedisConfig, MyBatisPlusConfig |
| 公共工具类 | ✅ | Result.java (统一响应), UserContext.java |
| SQL 文件 | ✅ | `sql/01-ddl.sql` + `sql/02-seed-data.sql` (需要你手动执行) |
| Entity (15个) | ✅ | user, role, permission, user_role, role_permission, novel, novel_role_visibility, node, node_edge, node_option, random_event, user_session, user_character, parse_record, llm_cache |
| Mapper (15个) | ✅ | 全部继承 BaseMapper |
| DTO (3个) | ✅ | LoginRequest, RegisterRequest, AuthResponse |
| AuthFilter | ✅ | Redis 会话验证, 白名单, 自动续期 |
| AuthService | ✅ | 注册(自动分配USER角色), 登录(查询RBAC), 登出, 会话管理 |
| Controllers | ✅ | AuthController (4个接口), TestController (3个测试接口) |

### 前端（已完成）
| 任务 | 状态 | 说明 |
|-----|------|------|
| Vite + React 项目 | ✅ | TypeScript, react-router-dom, axios |
| Tailwind CSS | ✅ | @tailwindcss/vite 插件 |
| useAuth hook | ✅ | sessionId 管理, 登录/注册/登出, 权限检查 |
| useApi | ✅ | axios 封装, 自动附加 Authorization header |
| LoginPage | ✅ | 表单验证, 错误提示, 登录后跳转 |
| RegisterPage | ✅ | 表单验证, 确认密码, 注册后跳转登录 |
| Navbar | ✅ | 用户菜单, 角色显示, 退出按钮, Admin 链接 |
| ProtectedRoute | ✅ | 权限守卫, 403 页面, 未登录重定向 |
| 构建 | ✅ | `npm run build` 成功 |

### 待你完成
1. **执行 SQL**：`mysql -u root -p novel_simulator < sql/01-ddl.sql` 和 `sql/02-seed-data.sql`
2. **确认 MySQL 连接**：修改 `application.yml` 中的数据库密码
3. **启动后端**：`mvn spring-boot:run`
4. **启动前端**：`cd frontend && npm run dev`

## 阶段完成记录

| 日期 | 阶段 | 完成内容 |
|------|------|---------|
| 2026-06-18 | P1 基础架构 | 全部代码编写完成（待数据库建表后联调） |

## 快速导航

- [P1 基础架构](P1-基础架构.md)
- [P2 内容管理](P2-内容管理.md)
- [P3 核心玩法](P3-核心玩法.md)
- [P4 叙事与评分](P4-叙事与评分.md)
- [P5 管理完善与移动端](P5-管理完善与移动端.md)
