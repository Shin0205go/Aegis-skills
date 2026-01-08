#!/usr/bin/env python3
"""
Aegis Architect - Scaffold Feature

ヘキサゴナルアーキテクチャに従った機能スケルトンを生成します。
これは「たい焼きの型」です。どんなAIが使っても、正しい構造になります。
"""

import argparse
import os
import sys
from pathlib import Path


def to_pascal_case(snake_str: str) -> str:
    """snake_case を PascalCase に変換"""
    return ''.join(word.capitalize() for word in snake_str.split('_'))


def to_snake_case(name: str) -> str:
    """名前を snake_case に正規化"""
    return name.lower().replace('-', '_').replace(' ', '_')


def load_template(template_name: str) -> str:
    """テンプレートファイルを読み込む"""
    script_dir = Path(__file__).parent
    template_path = script_dir / 'templates' / f'{template_name}.rs.tmpl'

    if not template_path.exists():
        raise FileNotFoundError(f"Template not found: {template_path}")

    return template_path.read_text(encoding='utf-8')


def render_template(template: str, context: dict) -> str:
    """テンプレートを変数で置換"""
    result = template
    for key, value in context.items():
        result = result.replace('{{' + key + '}}', value)
    return result


def scaffold_feature(name: str, description: str, target_dir: str) -> dict:
    """
    機能スケルトンを生成

    Returns:
        生成されたファイルのパスと内容の辞書
    """
    snake_name = to_snake_case(name)
    pascal_name = to_pascal_case(snake_name)

    context = {
        'name': snake_name,
        'pascal_name': pascal_name,
        'description': description,
    }

    target_path = Path(target_dir)

    # 生成するファイル構造
    files = {
        'domain': target_path / 'src' / 'domain' / f'{snake_name}.rs',
        'port': target_path / 'src' / 'ports' / f'{snake_name}_port.rs',
        'adapter': target_path / 'src' / 'adapters' / f'{snake_name}_adapter.rs',
    }

    generated = {}

    for layer, file_path in files.items():
        # テンプレート読み込み
        template = load_template(layer)
        content = render_template(template, context)

        # ディレクトリ作成
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # ファイル書き込み
        file_path.write_text(content, encoding='utf-8')
        generated[layer] = str(file_path)

    return generated


def update_mod_files(target_dir: str, name: str) -> list:
    """mod.rs ファイルを更新"""
    snake_name = to_snake_case(name)
    target_path = Path(target_dir)
    updated = []

    mod_files = [
        ('domain', target_path / 'src' / 'domain' / 'mod.rs'),
        ('ports', target_path / 'src' / 'ports' / 'mod.rs'),
        ('adapters', target_path / 'src' / 'adapters' / 'mod.rs'),
    ]

    for layer, mod_path in mod_files:
        mod_line = f'pub mod {snake_name};\n' if layer == 'domain' else f'pub mod {snake_name}_{"port" if layer == "ports" else "adapter"};\n'

        if mod_path.exists():
            content = mod_path.read_text(encoding='utf-8')
            if mod_line.strip() not in content:
                with open(mod_path, 'a', encoding='utf-8') as f:
                    f.write(mod_line)
                updated.append(str(mod_path))
        else:
            mod_path.parent.mkdir(parents=True, exist_ok=True)
            mod_path.write_text(mod_line, encoding='utf-8')
            updated.append(str(mod_path))

    return updated


def main():
    parser = argparse.ArgumentParser(
        description='Aegis Architect - ヘキサゴナルアーキテクチャ強制スキャフォールド',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
例:
  python scaffold_feature.py --name stock_price --description "株価を取得する機能"
  python scaffold_feature.py --name market_analysis --description "市場分析" --target ./my-project

生成されるファイル:
  {target}/src/domain/{name}.rs          # 聖域：純粋なドメインモデル
  {target}/src/ports/{name}_port.rs      # インターフェース定義
  {target}/src/adapters/{name}_adapter.rs # 実装の雛形
        '''
    )

    parser.add_argument(
        '--name', '-n',
        required=True,
        help='機能名（snake_case推奨）'
    )

    parser.add_argument(
        '--description', '-d',
        required=True,
        help='機能の説明'
    )

    parser.add_argument(
        '--target', '-t',
        default='./aegis-core',
        help='生成先ディレクトリ（デフォルト: ./aegis-core）'
    )

    parser.add_argument(
        '--no-mod-update',
        action='store_true',
        help='mod.rsの自動更新をスキップ'
    )

    args = parser.parse_args()

    print(f"{'='*60}")
    print("Aegis Architect - Architecture Enforced Scaffolding")
    print(f"{'='*60}")
    print(f"Feature: {args.name}")
    print(f"Description: {args.description}")
    print(f"Target: {args.target}")
    print(f"{'='*60}\n")

    try:
        # スケルトン生成
        generated = scaffold_feature(args.name, args.description, args.target)

        print("Generated files:")
        for layer, path in generated.items():
            print(f"  [{layer.upper():8}] {path}")

        # mod.rs更新
        if not args.no_mod_update:
            updated = update_mod_files(args.target, args.name)
            if updated:
                print("\nUpdated mod.rs files:")
                for path in updated:
                    print(f"  {path}")

        print(f"\n{'='*60}")
        print("Architecture enforced successfully!")
        print(f"Created {len(generated)} files for feature '{args.name}'")
        print(f"{'='*60}")

        # 次のステップを案内
        print("\nNext steps:")
        print(f"  1. Define domain models in: src/domain/{to_snake_case(args.name)}.rs")
        print(f"  2. Add trait methods in: src/ports/{to_snake_case(args.name)}_port.rs")
        print(f"  3. Implement adapter in: src/adapters/{to_snake_case(args.name)}_adapter.rs")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
