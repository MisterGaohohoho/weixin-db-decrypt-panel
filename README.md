# Weixin 4.1.9.23 数据库解密与本地可视化

本项目只提供两项功能：

1. 从正在运行的 Windows 微信 `4.1.9.23` 进程提取经校验的数据库派生密钥，并将 `.db` / `.kvdb` 解密为本地 SQLite 副本。
2. 以只读方式加载解密副本，在浏览器中查看联系人、会话、消息、媒体、搜索和统计结果。

项目不包含消息发送、账号自动化或远程托管服务。解密数据和可视化服务默认均留在本机。

本项目为非官方本地工具，与腾讯或微信团队无隶属或背书关系；仓库不分发 `Weixin.dll`、微信客户端或用户数据库。

## 安全边界

- 密钥提取器读取目标微信进程的内存映射；解密阶段只读取微信数据库原件，明文输出写入仓库内已忽略的 `data/db_decrypt/`。
- 面板通过 SQLite 只读 URI 和 `PRAGMA query_only=ON` 打开解密数据库，不对源快照执行迁移、写入、`VACUUM` 或 checkpoint。
- 分析缓存只写入 `.cache/`，可以删除并从解密快照重新生成。
- FastAPI 和 Vite 默认只监听 `127.0.0.1`。
- 项目不需要上传联系人、消息、头像、媒体、密钥或数据库。

`data/db_decrypt/keys.json` 包含数据库派生密钥，`data/db_decrypt/all/` 包含明文数据库。二者都属于敏感数据。

## 版本范围

解密布局和可选的原生 FTS tokenizer 针对 Windows 微信 `4.1.9.23`。其他微信版本的内存结构、SQLCipher 参数或 `Weixin.dll` 回调签名可能不同，本项目不声明兼容。

## 环境要求

- Windows 10/11 x64
- Windows 微信 `4.1.9.23` x64
- PowerShell 5.1 或 PowerShell 7
- 64 位 Python 3.11+
- Node.js `^20.19.0` 或 `>=22.12.0`，以及 npm
- 可选：Visual Studio 2022 C++ x64 Build Tools，用于构建微信原生 FTS tokenizer

## 安装

在仓库根目录执行：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
npm --prefix frontend ci
```

需要运行测试或参与开发时，改为安装开发依赖：

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

`requirements-lock.txt` 固定受支持的 Windows/Python 3.11 依赖版本，前端依赖由 `frontend/package-lock.json` 锁定。

## 1. 提取数据库密钥

先登录微信并保持客户端运行。查看候选进程：

```powershell
Get-Process Weixin | Select-Object Id, ProcessName, Path
```

对持有数据库映射的微信进程执行提取：

```powershell
.\.venv\Scripts\python.exe .\decrypt\wechat_db_decrypt.py extract `
  --pid <PID> `
  --output .\data\db_decrypt\keys.json
```

提取器只保存通过 codec context 和数据库页校验的候选密钥。如果进程权限不足，请使用与微信相同或更高权限的 PowerShell，并确认选择了正确的 `Weixin.exe` 进程。

## 2. 解密数据库

密钥提取完成后，建议正常退出微信，让数据库完成 checkpoint，再对数据库目录执行解密。目录模式会递归处理 `.db` 和 `.kvdb`：

```powershell
$SourceDbRoot = '<path-to-wechat-data>\wxid_xxx_abcd\db_storage'

.\.venv\Scripts\python.exe .\decrypt\wechat_db_decrypt.py decrypt `
  $SourceDbRoot `
  --account 'wxid_xxx' `
  --keys .\data\db_decrypt\keys.json `
  --output-dir .\data\db_decrypt\all `
  --report .\data\db_decrypt\decryption_report.json
```

`--account` 应填写微信账号 ID，而不是昵称。若源路径中包含可识别的 `wxid_*` 目录，工具可以自动推断；公开使用时仍建议显式传入，确保可视化面板读取到正确账号。

默认配置以 `all` 作为快照名称前缀。目录解密成功后会先在临时目录完成全部数据库的解密和校验，再原子发布为 `all.<snapshot-id>`，并由报告中的 `output_root` 指向该版本；任一数据库失败时不会切换报告。旧版本会保留，确认新版本工作正常后可手动删除不再使用的 `all.*` 目录。

逻辑输出结构为：

```text
data/db_decrypt/
|-- keys.json                  密钥清单，敏感
|-- decryption_report.json     账号、快照和校验元数据，敏感
`-- all.<snapshot-id>/         已解密 SQLite 数据库，敏感
```

工具在写出结果前校验页面 HMAC、SQLite 头和文件页数。若源 WAL 含有效提交，工具会拒绝生成可能过期的主库快照。`--ignore-wal` 仅适用于明确接受未合并 WAL 数据缺失的场景。

单文件模式及全部参数可通过以下命令查看：

```powershell
.\.venv\Scripts\python.exe .\decrypt\wechat_db_decrypt.py decrypt --help
```

## 可选：原生 FTS 搜索

解密本身不依赖原生 tokenizer。联系人拼音、消息和收藏的微信原生全文搜索需要构建 `MMFtsTokenizer` 扩展，并在运行时使用匹配版本的本机 `Weixin.dll`：

以下命令中的 `<path-to-weixin-4.1.9.23>` 应替换为本机微信 `4.1.9.23` 的安装目录。

```powershell
powershell -ExecutionPolicy Bypass -File .\native\weixin_fts_tokenizer\build.ps1
$env:WEIXIN_DLL_PATH = '<path-to-weixin-4.1.9.23>\Weixin.dll'
```

构建产物位于 `dist/weixin_fts_tokenizer.dll`。首次构建会下载 SQLite 公开扩展头文件并校验固定 SHA-256。扩展会检查 `Weixin.dll` 的回调签名并拒绝不匹配的版本。

未构建扩展时，数据库仍可解密，非 FTS 可视化功能仍可使用；微信原生全文搜索及 FTS 数据库的完整性检查不可用或会降级。

## 启动面板

完成解密后，在仓库根目录执行：

```powershell
$env:WEIXIN_DLL_PATH = '<path-to-weixin-4.1.9.23>\Weixin.dll'
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

本地地址：

- Web：`http://127.0.0.1:5173/overview`
- API：`http://127.0.0.1:8765/api`
- 健康检查：`http://127.0.0.1:8765/api/health`

按 `Ctrl+C` 停止两个服务。常用启动参数：

```powershell
.\scripts\dev.ps1 -NoBrowser
.\scripts\dev.ps1 -ApiPort 9000 -WebPort 5174
.\scripts\dev.ps1 -PythonPath '<path-to-python>\python.exe'
```

## 配置

后端直接读取进程环境变量，不会自动加载仓库根目录的 `.env`。`.env.example` 用于记录可配置项；可在启动前将需要的值设置到当前 PowerShell 会话。`scripts/dev.ps1` 仅为未设置的变量填入默认值，不会覆盖当前会话中的自定义路径。

| 环境变量 | 默认值 | 用途 |
|---|---|---|
| `WECHAT_DB_ROOT` | `data/db_decrypt/all` | 解密数据库快照名称前缀；报告可指向同级 `all.<snapshot-id>` |
| `WECHAT_DECRYPTION_REPORT` | `data/db_decrypt/decryption_report.json` | 账号、快照和校验报告 |
| `WECHAT_ANALYTICS_CACHE` | `.cache/analytics.sqlite` | 可重建的本地分析缓存，必须位于项目 `.cache/` 内 |
| `WECHAT_FTS_EXTENSION` | `dist/weixin_fts_tokenizer.dll` | 可选 FTS5 tokenizer 扩展 |
| `WEIXIN_DLL_PATH` | `data/Weixin.dll` | 与 tokenizer 匹配的本机 DLL 路径 |
| `WECHAT_TIMEZONE` | `Asia/Shanghai` | 日期边界和显示时区 |
| `WECHAT_EPISODE_GAP_SECONDS` | `1800` | 会话分段间隔 |
| `WECHAT_RESPONSE_MAX_SECONDS` | `86400` | 响应时长统计上限 |

手动分别启动服务时，请在两个 PowerShell 终端中分别执行：

```powershell
$env:WECHAT_DB_ROOT = (Resolve-Path .\data\db_decrypt\all).Path
$env:WECHAT_DECRYPTION_REPORT = (Resolve-Path .\data\db_decrypt\decryption_report.json).Path
$env:WEIXIN_DLL_PATH = '<path-to-weixin-4.1.9.23>\Weixin.dll'

# 终端 1：API
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8765
```

```powershell
# 终端 2：Web
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173
```

## 测试

```powershell
# Python、前端单元测试和前端构建
powershell -ExecutionPolicy Bypass -File .\scripts\test.ps1 -SkipBrowser

# 本地存在解密快照时，额外执行 Playwright 端到端测试
powershell -ExecutionPolicy Bypass -File .\scripts\test.ps1
```

公开仓库的 Windows CI 会运行 Python/Vitest/构建/依赖审计，并在无任何解密数据的 clean checkout 中验证首次运行页面。真实快照 E2E 只在本机数据存在时执行，真实数据库和测试产物不会进入 CI。

## 敏感文件

以下文件不得提交到公开仓库：

- `keys.json` 或任何导出的数据库密钥清单
- `data/db_decrypt/` 或其他明文数据库副本
- `decryption_report.json`，其中可能包含账号 ID 和本机绝对路径
- 微信安装目录中的 `Weixin.dll`
- `.cache/`、导出文件、日志、测试报告和截图产物中的真实聊天数据

仓库提供的 `.gitignore` 覆盖默认路径和常见扩展名。提交前仍应执行 `git status --short` 并人工检查。

## 文档

- `docs/ARCHITECTURE.md`：本地双端架构和只读边界
- `docs/DATA_SCHEMA.md`：数据库表、字段和关联方式
- `docs/METRICS.md`：统计指标定义
- `native/weixin_fts_tokenizer/README.md`：可选 tokenizer 构建说明

## 社区与交流

本项目链接并认可 [LINUX DO - 新的理想型社区](https://linux.do/)。

欢迎加入 [Telegram 交流群](https://t.me/+ysiKW1_D12I3ZjY0)，交流使用问题、功能建议与开发进展。

## License

[MIT](LICENSE)

## 相关文章

[微信数据库解密与可视化面板](https://bk.47claude.com/posts/wechat-db-decrypt-visualization-panel/)
