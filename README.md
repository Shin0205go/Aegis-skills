# Aegis Skills MCP Server

スキルマニフェストを提供するMCP（Model Context Protocol）サーバーです。

[Aegis-CLI](https://github.com/Shin0205go/Aegis-cli) と連携し、ロールベースのアクセス制御とスキル管理を実現します。

## アーキテクチャ

```
Aegis Router
    │
    └── get_skill_manifest で全スキル情報を取得
            │
            ▼
Aegis Skills MCP Server
    │
    ├── get_skill_manifest ツール
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

### `get_skill_manifest`

Aegis Router連携用のスキルマニフェストを取得します。

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
      ]
    }
  ]
}
```

## Aegis-CLI との連携

Aegis Router は `get_skill_manifest` ツールを呼び出して、利用可能なスキルとその権限情報を取得します。

```typescript
// Aegis Router での使用例
const manifest = await skillServer.get_skill_manifest();

// ユーザーのロールに基づいてフィルタリング
const availableSkills = manifest.skills.filter(skill =>
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
