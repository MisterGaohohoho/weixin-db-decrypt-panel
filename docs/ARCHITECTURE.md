# 系统架构

## 目标

面板是一个仅本机运行的只读分析应用。FastAPI 负责连接微信 SQLite 数据库、规范化消息、计算指标和提供资源流；React 负责概览、联系人、媒体、贡献、会话、聊天列表、搜索和设置页面，以及筛选、图表和导出。

## 目录职责

```text
./
|-- backend/app/          FastAPI、repository、解析器和指标服务
|-- backend/tests/        Python 数据层与 API 测试
|-- frontend/src/         React 页面、组件、查询和样式
|-- frontend/tests/       Playwright 交互测试
|-- docs/                 架构、schema 和指标文档
|-- scripts/              PowerShell 启动与测试入口
`-- .cache/               可删除、可重建的真实派生缓存
```

数据库和 tokenizer 默认位于仓库内的本地运行时目录（这些内容应保持在公开仓库之外）：

```text
data/db_decrypt/all.<id>/       已解密 SQLite 主库快照
data/db_decrypt/decryption_report.json
dist/weixin_fts_tokenizer.dll
```

## 运行时拓扑

```text
Chromium / Browser
        |
        | HTTP 127.0.0.1
        v
React + Vite :5173
        |
        | /api proxy
        v
FastAPI + Uvicorn :8765
        |
        +--> read-only SQLite repositories
        +--> WCDB Zstandard/XML message parser
        +--> metrics and aggregation services
        +--> FTS5 connection + MMFtsTokenizer
        +--> local avatar/media resolver
        `--> .cache/analytics.sqlite (derived data only)
```

两个服务默认只监听 `127.0.0.1`。前端不直接读取数据库文件，所有动态数字必须经由 API 返回。

## 后端分层

### 配置层

`backend.app.config.Settings` 从环境变量解析数据库根目录、解密报告、缓存、FTS 扩展、`Weixin.dll`、时区和指标阈值。默认路径均以仓库位置推导，不硬编码当前账号昵称。

### 数据访问层

普通数据库连接必须满足：

```text
file:///path/to/database.db?mode=ro&immutable=1
PRAGMA query_only=ON
```

连接通过 context manager 显式关闭。表名不能来自未经验证的请求参数；实际存在的 `Msg_*` 表只从 `sqlite_master` 和 `Name2Id` 映射中选择并使用标识符转义。

FTS 连接还需要：

1. 设置 `WEIXIN_DLL_PATH`。
2. 在每一个新 SQLite connection 上启用扩展加载。
3. 加载 `dist/weixin_fts_tokenizer.dll`。
4. 立即关闭扩展加载能力。
5. 设置 `PRAGMA query_only=ON`。

扩展和 `Weixin.dll` 都必须匹配 Windows 微信 `4.1.9.23`；其他版本不在当前兼容范围内。

### 规范化层

不同 `Msg_*` 表转换成统一消息模型。最低字段集合为：

| 字段 | 含义 |
|---|---|
| `session_username` | `Name2Id.user_name`，也是消息表 MD5 的输入 |
| `table_name` | 实际 `Msg_<md5>` 表 |
| `local_id` / `server_id` | 本地和服务端消息标识 |
| `local_type` | 未截断的 64 位组合类型 |
| `base_type` | `local_type & 0xffffffff` |
| `app_subtype` | `local_type >> 32` |
| `sort_seq` / `create_time` | 排序序列和 Unix 时间 |
| `real_sender_id` | 发送者 ID，结合 `Name2Id`/联系人解析 |
| `is_self` | 发送者是否为报告中的当前账号 |
| `content` | 真实解码后的文本或 XML 摘要 |
| `decoded` | 解压和字符解码是否成功 |
| `decode_error` | 可机器读取的失败原因 |
| `reference` | `<refermsg>` 结构和回连状态 |
| `resource_available` | 本地资源是否实际存在 |

规范化过程保留原始标识和错误状态，不能用示例内容填补缺失值。

### 解析层

- `message_content` 或其他压缩字段以 `28 B5 2F FD` 开头时使用 Zstandard 解压。
- 文本按真实编码结果解码；失败时返回 `decoded=false` 和错误类型。
- 群消息的 `sender_username:\n` 前缀解析为实际发送者，再从联系人或 `Name2Id` 获取显示名。
- `base_type=49` 的 app message 使用安全 XML 解析，提取文件、链接、图片、视频和引用等结构。
- `app_subtype=57` 解析 `<refermsg>` 的 `svrid/fromusr/chatusr/displayname/content`，优先按 `server_id` 回连原消息。

### 服务层

服务按页面输出已经聚合的视图模型，同时包含数据质量元数据：

- `decoded`
- `resource_available`
- `metric_basis`
- `snapshot_time`
- `snapshot_status`

主要 API 契约：

| 路径 | 用途 |
|---|---|
| `GET /api/health` | 路径、快照和服务健康状态 |
| `GET /api/profile` | 当前账号资料与头像 |
| `GET /api/overview` | KPI、趋势、类型、排行和热力图 |
| `GET /api/contacts` | 联系人指标、排行和表格 |
| `GET /api/contacts/graph` | 关系网络节点与边 |
| `GET /api/chat-list` | 按最新真实消息排序的会话列表和类型计数 |
| `GET /api/chat-list/{username}` | 会话消息、资料、文件、年度热力图和当日统计 |
| `GET /api/media` | 媒体统计、文件、链接、关键词和 OCR |
| `GET /api/contributions` | 年度热力图、日期统计和引用 |
| `GET /api/conversations` | episode 时间线和筛选结果 |
| `GET /api/conversations/export` | 按当前筛选导出 CSV、JSON 或 HTML |
| `GET /api/conversations/{episode_id}` | 单个 episode 的完整消息 |
| `GET /api/messages/{message_id}` | 单条规范化消息及引用信息 |
| `GET /api/search` | 消息、联系人和收藏 FTS 搜索 |
| `GET /api/fts/validate` | 本机 FTS 数据库与 tokenizer 校验 |
| `GET /api/avatars/{username}` | 本地头像或稳定占位头像 |
| `GET /api/resources/{kind}/{rowid}` | 只读本地媒体资源 |
| `GET /api/settings` | 本机只读配置和快照状态 |

列表端点必须有显式 limit/offset 或 cursor 上限，避免把所有消息一次性传到浏览器。

## 前端分层

- React Router 提供 `/overview`、`/contacts`、`/media`、`/contributions`、`/conversations`、`/chat-list`、`/search` 和 `/settings`。
- TanStack Query 管理 API 请求、加载、错误、重试和缓存失效。
- ECharts 渲染图表，关键词词云使用无插件的 DOM 组件；图表旁提供文本摘要。
- 长消息和会话列表使用虚拟化，日期标题保留吸顶行为。
- Lucide React 提供同一线宽的 SVG 图标，不使用 emoji 作为结构图标。
- CSS 变量保存共享视觉 token，并允许路由级覆盖侧栏宽度、主区起点和卡片间距。

页面必须处理 `loading`、`error`、`empty`、`partial` 四种数据状态。资源不存在、OCR 未运行或指标无可靠来源时显示具体空状态。

## 缓存和失效

`.cache/analytics.sqlite` 只能保存从源库派生的数据。缓存键至少包含：

```text
absolute_path + file_size + mtime_ns + report_sha256_or_snapshot_id
```

任一源指纹变化时，该源对应派生结果失效。缓存可以删除并由应用重建，不能成为联系人、消息或统计的唯一来源。首次扫描会把实际存在的消息表规范化到缓存，API 请求不应重复执行完整 UNION。

当前资源链路先按 `message_svr_id`，缺失时按 `(chat_id, message_local_id)` 将 `MessageResourceInfo/Detail` 回连到规范化消息。protobuf length-delimited 字段只做本地 UTF-8 元数据提取，硬链接候选再按真实文件大小 best-effort 匹配。API 分别返回 `resource_available` 和 `browser_supported`，不能把“有索引”“磁盘存在”和“浏览器可预览”混成同一状态。

## 快照语义

`decryption_report.json.created_utc` 是面板的快照时间。报告中的部分原始 WAL 含有效提交帧，因此 UI 不能把数据状态描述为无条件“实时”。状态卡至少区分：

目录解密在同级临时目录中完成全部数据库后，发布为 `all.<snapshot-id>`，最后原子替换报告以切换活动快照。任一数据库失败都不会改变当前报告，已连接的读者可继续使用旧快照。分析缓存同样按源指纹和唯一 ID 版本化，切换时不覆盖 Windows 上正被读取的 SQLite 文件。

- 报告时间
- 主库快照/可能未合并 WAL
- `quick_check` 和 `integrity_check`
- 未解密文件列表

## 隐私与资源访问

- API 不提供任意文件路径读取；资源路由只接受类型和数据库 rowid，再由服务端解析白名单路径。
- 解析后的路径必须 `resolve()`，并验证位于报告的账号根目录或允许的缓存/导出目录内。
- 响应中不暴露数据库密钥或 `keys.json` 内容。仅回环可访问的健康检查和设置端点会返回当前配置的数据与缓存路径，便于本机排错。
- 导出内容来自当前筛选，默认写到浏览器下载或项目导出目录，不回写微信目录。
- 不发送网络头像请求作为数据分析前提。本地头像优先，URL 仅作为不可用时的元数据。

## 性能边界

首次启动可能需要扫描较大的本地快照。目标约束：

- 聚合 API 使用派生索引或单次扫描结果，不在每次请求重复 UNION 全部消息表。
- API 分页并限制排序字段白名单。
- 图表只传聚合点，消息正文按需加载。
- 头像和缩略图设置合理的本地缓存头，但不写回源数据库。
- 50 条以上的前端时间线启用虚拟化。

## 可访问性与交互质量

- 键盘焦点顺序与视觉顺序一致，图标按钮有 `aria-label`。
- 图表不能只依靠颜色表达含义，并提供可读摘要。
- 尊重 `prefers-reduced-motion`。
- 交互测试使用本机 Chromium 和固定视口，以便稳定验证路由、筛选和错误状态。
