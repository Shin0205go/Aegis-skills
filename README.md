# Aegis Skills MCP Server

スキルマニフェストを提供するMCP（Model Context Protocol）サーバーです。

[Aegis-CLI](https://github.com/Shin0205go/Aegis-cli) と連携し、ロールベースのアクセス制御とスキル管理を実現します。

## アーキテクチャ

```
Aegis Router
    │
    └── list_skills で全スキル情報を取得
            │
            ▼
Aegis Skills MCP Server
    │
    ├── list_skills ツール
    │   └── 全スキルの一覧と権限情報を返す
    │
    └── skills/
        ├── docx-handler/
        │   └── SKILL.md
        ├── code-reviewer/
        │   └── SKILL.md
        └── data-analyzer/
            └── SKILL.md
```

## インストール

```bash
npm install
```

## 使い方

```bash
# デフォルトのスキルディレクトリを使用 (~/.skills)
node index.js

# カスタムディレクトリを指定
node index.js /path/to/my/skills

# 同梱のサンプルスキルを使用
npm run start:sample
```

## スキル定義 (SKILL.md)

各スキルディレクトリに `SKILL.md` ファイルを配置します：

```yaml
---
name: skill-name
displayName: Skill Display Name  # 省略時はnameから自動生成
description: スキルの説明
allowed-tools:
  - mcp__plugin_filesystem_filesystem__read_file
  - mcp__plugin_filesystem_filesystem__write_file
allowedRoles:
  - editor
  - admin
  - "*"  # 全ロールに許可
---

# スキル名

スキルの詳細な説明やプロンプトを記述します。
```

### フロントマターのフィールド

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `name` | はい | スキルの一意な識別子 |
| `description` | はい | スキルの簡単な説明 |
| `displayName` | いいえ | 表示用の名前（省略時はnameから自動生成） |
| `allowed-tools` | いいえ | このスキルで使用可能なMCPツールの一覧 |
| `allowedRoles` | いいえ | このスキルを使用できるロールの一覧 |

## 提供されるMCPツール

### `list_skills`

利用可能なすべてのスキルとメタデータ・権限情報を取得します。Aegis Routerがスキルの可用性とアクセス制御を決定するために使用します。

**パラメータ:** なし

**戻り値:**

```json
{
  "skills": [
    {
      "id": "docx-handler",
      "displayName": "DOCX Handler",
      "description": "Word文書の操作",
      "allowedRoles": ["editor", "admin"],
      "allowedTools": [
        "mcp__plugin_filesystem_filesystem__read_file",
        "mcp__plugin_filesystem_filesystem__write_file"
      ],
      "resourceCount": 3
    }
  ]
}
```

### `get_skill`

指定したスキルの `SKILL.md` の全内容を取得します。

**パラメータ:**
- `name` (string, 必須): スキル名

**戻り値:** SKILL.mdファイルの内容

### `list_resources`

指定したスキル内のリソースファイル一覧を取得します。

**パラメータ:**
- `skill` (string, 必須): スキル名

**戻り値:** リソースパスの配列

### `get_resource`

指定したリソースファイルの内容を取得します。

**パラメータ:**
- `skill` (string, 必須): スキル名
- `path` (string, 必須): リソースファイルの相対パス

**戻り値:** ファイルの内容

### `run_script`

スキル内のスクリプトファイルを実行します。

**パラメータ:**
- `skill` (string, 必須): スキル名
- `path` (string, 必須): スクリプトファイルの相対パス
- `args` (array, 任意): スクリプトに渡す引数

**対応スクリプト:** Python (`.py`)、Shell (`.sh`)、Node.js (`.js`)

**戻り値:** スクリプトの実行結果

## Aegis-CLI との連携

Aegis Router は `list_skills` ツールを呼び出して、利用可能なスキルとその権限情報を取得します。

```typescript
// Aegis Router での使用例
const result = await skillServer.list_skills();
const { skills } = JSON.parse(result);

// ユーザーのロールに基づいてフィルタリング
const availableSkills = skills.filter(skill =>
  skill.allowedRoles.includes('*') ||
  skill.allowedRoles.includes(userRole)
);
```

### ロールベースアクセス制御

- `allowedRoles: ["*"]` - 全ロールにアクセスを許可
- `allowedRoles: ["admin"]` - admin ロールのみ
- `allowedRoles: ["editor", "admin"]` - editor または admin ロール

## 同梱サンプルスキル

| スキル | 説明 | 許可ロール |
|--------|------|-----------|
| `docx-handler` | Word文書の操作 | editor, admin |
| `code-reviewer` | コードレビューの自動化 | developer, senior-developer, admin |
| `data-analyzer` | データ分析と可視化 | 全ロール (*) |

## MCPクライアント設定

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aegis-skills": {
      "command": "node",
      "args": ["/path/to/aegis-skills/index.js", "/path/to/skills"]
    }
  }
}
```

### VS Code (GitHub Copilot)

`.vscode/mcp.json`:

```json
{
  "servers": {
    "aegis-skills": {
      "command": "node",
      "args": ["/path/to/aegis-skills/index.js", "/path/to/skills"]
    }
  }
}
```

## 関連リンク

- [Aegis-CLI](https://github.com/Shin0205go/Aegis-cli) - ロールベースアクセス制御付きCLI
- [MCP](https://modelcontextprotocol.io) - Model Context Protocol

## ライセンス

MIT
