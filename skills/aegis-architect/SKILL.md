---
name: aegis-architect
displayName: Aegis Architect
description: アーキタイプベースのスキャフォールドツール - プロジェクトの重さに応じた型を選択
allowed-tools:
  - aegis-skills__run_script
allowedRoles:
  - architect
  - senior-developer
  - admin
---

# Aegis Architect

**AIをコーダーからオペレーターへ変える**

このスキルは「たい焼きの型」です。どんなAIが使っても、選んだアーキタイプに従った正しい構造が生成されます。

## コンセプト

```
Before (プロンプト依存):
  AI: 「ファイル作ります...あれ、どこに置こう？まあここでいいか」
  → 結果: 構造が崩れる

After (Aegis Architect):
  AI: 「scaffold_feature --archetype rust_hexagonal」を実行
  Aegis: (ガシャン！) 3ファイルを強制生成
  → 結果: 誰がやっても100%正しい構造
```

## アーキタイプ（型の選択）

プロジェクトの「重さ」に応じて適切な型を選択します。

| アーキタイプ | 用途 | 生成ファイル |
|-------------|------|-------------|
| `rust_hexagonal` | 堅牢なコアシステム | Domain/Port/Adapter (3ファイル) |
| `rust_cli_simple` | 小さなCLIツール | main.rs + Cargo.toml |
| `python_script` | 使い捨てスクリプト | script.py (1ファイル) |

### 選び方

```
「長期運用？外部依存の差し替え？チーム開発？」
  → YES: rust_hexagonal

「単機能のCLIツール？学習目的？」
  → YES: rust_cli_simple

「自動化スクリプト？PoC？使い捨て？」
  → YES: python_script
```

## 使い方

### アーキタイプ一覧を確認

```bash
run_script aegis-architect scaffold_feature.py --list-archetypes
```

### Hexagonal構造で生成（デフォルト）

```bash
run_script aegis-architect scaffold_feature.py \
  --name market_analysis \
  --description "株価を分析する機能" \
  --target ./aegis-core
```

生成されるファイル:
```
aegis-core/
├── src/domain/market_analysis.rs      # 聖域：純粋なドメインモデル
├── src/ports/market_analysis_port.rs  # インターフェース定義
└── src/adapters/market_analysis_adapter.rs  # 実装の雛形
```

### シンプルなCLIツールとして生成

```bash
run_script aegis-architect scaffold_feature.py \
  --name my_tool \
  --description "便利ツール" \
  --archetype rust_cli_simple
```

### Pythonスクリプトとして生成

```bash
run_script aegis-architect scaffold_feature.py \
  --name fetch_data \
  --description "データ取得" \
  --archetype python_script
```

## 設計原則（rust_hexagonal）

```
┌─────────────────────────────────────────┐
│              Domain (Core)              │
│  - 外部依存ゼロ                         │
│  - 純粋な構造体とビジネスロジック       │
│  - ここが「聖域」                       │
└─────────────────────────────────────────┘
                    ▲
                    │ 依存の方向
                    │
┌─────────────────────────────────────────┐
│              Ports (Traits)             │
│  - Domainの型を使うインターフェース     │
│  - 外部との境界を定義                   │
└─────────────────────────────────────────┘
                    ▲
                    │
┌─────────────────────────────────────────┐
│           Adapters (実装)               │
│  - Portを実装                           │
│  - 外部API/DB/ファイルシステムへ接続    │
│  - ここだけが「汚れてよい」             │
└─────────────────────────────────────────┘
```

## なぜツールで強制するのか

| アプローチ | 問題点 |
|-----------|--------|
| 設計書を書く | 読まれない、守られない |
| プロンプトで指示 | AIは忘れる、解釈がブレる |
| コードレビュー | 事後対応、手戻りが発生 |
| **ツールで強制** | 物理的に正しい構造しか作れない |

## 使用例

```
ユーザー: 「株価取得機能を追加して」

AI（Aegis Architect使用）:
1. プロジェクトの規模を判断 → AEGIS本体なのでrust_hexagonalを選択
2. scaffold_feature.py --name stock_price --archetype rust_hexagonal を実行
3. 生成された domain/stock_price.rs にドメインモデルを定義
4. ports/stock_price_port.rs にトレイトメソッドを追加
5. adapters/stock_price_adapter.rs に実装を書く

→ 手順を飛ばしたり、構造を無視することが不可能
```

## アーキタイプの追加方法

新しいアーキタイプを追加するには:

1. `archetypes/<name>/` ディレクトリを作成
2. `manifest.json` でメタデータと生成ファイルを定義
3. テンプレートファイル (`.tmpl`) を配置

## 今後の拡張

- [ ] validate_arch - 既存コードのアーキテクチャ違反検出
- [ ] migrate_to_hex - レガシーコードの移行支援
- [ ] テスト雛形の自動生成
- [ ] CI連携（PRでvalidate_archを自動実行）
- [ ] Rust版への移植（Tera/Askamaテンプレートエンジン）
