---
name: aegis-architect
displayName: Aegis Architect
description: ヘキサゴナルアーキテクチャを強制するスキャフォールドツール
allowed-tools:
  - aegis-skills__run_script
allowedRoles:
  - architect
  - senior-developer
  - admin
---

# Aegis Architect

**AIをコーダーからオペレーターへ変える**

このスキルは「たい焼きの型」です。どんなAIが使っても、出力は必ずヘキサゴナルアーキテクチャに従います。

## コンセプト

```
Before (プロンプト依存):
  AI: 「ファイル作ります...あれ、どこに置こう？まあここでいいか」
  → 結果: 構造が崩れる

After (Aegis Architect):
  AI: 「scaffold_feature("stock_price") を実行」
  Aegis: (ガシャン！) 3ファイルを強制生成
  → 結果: 誰がやっても100%ヘキサゴナル
```

## ツール

### `scaffold_feature`

新機能のスケルトンをヘキサゴナル構造で生成します。

**使い方:**
```bash
run_script aegis-architect scaffold_feature.py --name market_analysis --description "株価を分析する機能"
```

**生成されるファイル:**
```
aegis-core/
├── src/domain/market_analysis.rs      # 聖域：純粋なドメインモデル
├── src/ports/market_analysis_port.rs  # インターフェース定義
└── src/adapters/market_analysis_adapter.rs  # 実装の雛形
```

### `validate_arch`

既存コードがアーキテクチャに違反していないか検証します。

**チェック項目:**
- Domain層が外部クレートに依存していないか
- Port層がDomain層の型のみを使用しているか
- Adapter層が適切にPortを実装しているか

### `migrate_to_hex`

レガシーコードをヘキサゴナル構造へ段階的に移行します。

## 設計原則

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
1. scaffold_feature("stock_price", "外部APIから株価を取得") を実行
2. 生成された domain/stock_price.rs にドメインモデルを定義
3. ports/stock_price_port.rs にトレイトメソッドを追加
4. adapters/stock_price_adapter.rs に実装を書く

→ 手順を飛ばしたり、構造を無視することが不可能
```

## 今後の拡張

- [ ] テスト雛形の自動生成
- [ ] CI連携（PRでvalidate_archを自動実行）
- [ ] アーキテクチャ図の自動生成
