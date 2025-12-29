# agent-skills-server

ディレクトリベースのスキルをMCP（Model Context Protocol）ツールとして公開するサーバーです。

## 概要

各スキルは `SKILL.md` ファイルと関連リソースで構成され、AIエージェントが動的にスキルを取得・実行できます。

## インストール

```bash
npm install
```

## 使い方

### 基本的な起動

```bash
node index.js [skills-directory]
```

- `skills-directory`: スキルが格納されているディレクトリのパス（省略時: `~/.skills`）

### 例

```bash
# デフォルトのスキルディレクトリを使用
node index.js

# カスタムディレクトリを指定
node index.js /path/to/my/skills
```

## スキルの構造

各スキルは以下の構造を持つディレクトリです：

```
skill-name/
├── SKILL.md          # スキルの説明とプロンプト（必須）
├── resource1.py      # リソースファイル（任意）
├── resource2.js
└── subdirectory/
    └── resource3.txt
```

### SKILL.md の形式

```markdown
---
name: スキル名
description: スキルの簡単な説明
license: MIT
compatibility:
  - claude
  - copilot
---

# スキル名

ここにスキルの詳細な説明やプロンプトを記述します。
```

## 提供されるMCPツール

### `list_skills`

利用可能なすべてのスキルの一覧を取得します。

**パラメータ:** なし

**戻り値:** スキル名、説明、リソース数を含むJSON配列

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

**戻り値:** ファイルの内容（テキストまたはBase64エンコードされたバイナリ）

### `run_script`

スキル内のスクリプトファイルを実行します。

**パラメータ:**
- `skill` (string, 必須): スキル名
- `path` (string, 必須): スクリプトファイルの相対パス
- `args` (array, 任意): スクリプトに渡す引数

**対応スクリプト:**
- Python (`.py`)
- Shell (`.sh`)
- Node.js (`.js`)

**戻り値:** スクリプトの実行結果（stdout/stderr）

## MCPクライアント設定

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-skills": {
      "command": "node",
      "args": ["/path/to/agent-skills-server/index.js", "/path/to/skills"]
    }
  }
}
```

### VS Code (GitHub Copilot)

`.vscode/mcp.json`:

```json
{
  "servers": {
    "agent-skills": {
      "command": "node",
      "args": ["/path/to/agent-skills-server/index.js", "/path/to/skills"]
    }
  }
}
```

## 関連リンク

- [Agent Skills 仕様](https://agentskills.io) - Agent Skills公式仕様
- [MCP](https://modelcontextprotocol.io) - Model Context Protocol

## ライセンス

MIT
