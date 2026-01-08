#!/usr/bin/env python3
"""
Aegis Architect - Scaffold Feature

プロジェクトの「重さ」に応じた適切なアーキタイプを選択し、
スケルトンを生成します。

アーキタイプ（型）:
  - rust_hexagonal: 堅牢なコアシステム用（Domain/Port/Adapter分離）
  - rust_cli_simple: 小さなCLIツール用（1ファイル構成）
  - python_script: 使い捨てスクリプト用
"""

import argparse
import json
import sys
from pathlib import Path


def to_pascal_case(snake_str: str) -> str:
    """snake_case を PascalCase に変換"""
    return ''.join(word.capitalize() for word in snake_str.split('_'))


def to_snake_case(name: str) -> str:
    """名前を snake_case に正規化"""
    return name.lower().replace('-', '_').replace(' ', '_')


def get_archetypes_dir() -> Path:
    """アーキタイプディレクトリを取得"""
    return Path(__file__).parent / 'archetypes'


def list_archetypes() -> list:
    """利用可能なアーキタイプ一覧を取得"""
    archetypes_dir = get_archetypes_dir()
    result = []

    for path in archetypes_dir.iterdir():
        if path.is_dir():
            manifest_path = path / 'manifest.json'
            if manifest_path.exists():
                with open(manifest_path, encoding='utf-8') as f:
                    manifest = json.load(f)
                    result.append(manifest)

    return result


def load_archetype(name: str) -> dict:
    """アーキタイプのマニフェストを読み込む"""
    manifest_path = get_archetypes_dir() / name / 'manifest.json'

    if not manifest_path.exists():
        available = [a['name'] for a in list_archetypes()]
        raise ValueError(
            f"Archetype '{name}' not found. Available: {', '.join(available)}"
        )

    with open(manifest_path, encoding='utf-8') as f:
        return json.load(f)


def load_template(archetype: str, template_name: str) -> str:
    """テンプレートファイルを読み込む"""
    template_path = get_archetypes_dir() / archetype / template_name

    if not template_path.exists():
        raise FileNotFoundError(f"Template not found: {template_path}")

    return template_path.read_text(encoding='utf-8')


def render_template(template: str, context: dict) -> str:
    """テンプレートを変数で置換"""
    result = template
    for key, value in context.items():
        result = result.replace('{{' + key + '}}', str(value))
    return result


def scaffold_feature(
    name: str,
    description: str,
    archetype: str,
    target_dir: str
) -> dict:
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

    # マニフェスト読み込み
    manifest = load_archetype(archetype)
    target_path = Path(target_dir)

    generated = {}

    for file_spec in manifest['files']:
        # テンプレート読み込み
        template = load_template(archetype, file_spec['template'])
        content = render_template(template, context)

        # 出力パス生成
        output_path = file_spec['output']
        for key, value in context.items():
            output_path = output_path.replace('{{' + key + '}}', value)

        file_path = target_path / output_path

        # ディレクトリ作成
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # ファイル書き込み
        file_path.write_text(content, encoding='utf-8')
        generated[file_spec['layer']] = str(file_path)

    return generated


def update_mod_files(target_dir: str, name: str, archetype: str) -> list:
    """mod.rs ファイルを更新（rust_hexagonalのみ）"""
    if archetype != 'rust_hexagonal':
        return []

    snake_name = to_snake_case(name)
    target_path = Path(target_dir)
    updated = []

    mod_files = [
        ('domain', target_path / 'src' / 'domain' / 'mod.rs', f'{snake_name}'),
        ('ports', target_path / 'src' / 'ports' / 'mod.rs', f'{snake_name}_port'),
        ('adapters', target_path / 'src' / 'adapters' / 'mod.rs', f'{snake_name}_adapter'),
    ]

    for layer, mod_path, mod_name in mod_files:
        mod_line = f'pub mod {mod_name};\n'

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


def print_archetype_info(archetype: dict) -> None:
    """アーキタイプ情報を表示"""
    print(f"\n  {archetype['displayName']}")
    print(f"  {archetype['description']}")
    print("\n  Use when:")
    for item in archetype.get('use_when', []):
        print(f"    - {item}")
    print("\n  Avoid when:")
    for item in archetype.get('avoid_when', []):
        print(f"    - {item}")


def main():
    parser = argparse.ArgumentParser(
        description='Aegis Architect - アーキタイプベースのスキャフォールド',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
例:
  # Hexagonal構造で生成（デフォルト）
  python scaffold_feature.py --name stock_price --description "株価取得"

  # シンプルなCLIツールとして生成
  python scaffold_feature.py --name my_tool --description "便利ツール" --archetype rust_cli_simple

  # Pythonスクリプトとして生成
  python scaffold_feature.py --name fetch_data --description "データ取得" --archetype python_script

  # 利用可能なアーキタイプを表示
  python scaffold_feature.py --list-archetypes
        '''
    )

    parser.add_argument(
        '--name', '-n',
        help='機能名（snake_case推奨）'
    )

    parser.add_argument(
        '--description', '-d',
        help='機能の説明'
    )

    parser.add_argument(
        '--archetype', '-a',
        default='rust_hexagonal',
        help='アーキタイプ（デフォルト: rust_hexagonal）'
    )

    parser.add_argument(
        '--target', '-t',
        default='.',
        help='生成先ディレクトリ（デフォルト: カレント）'
    )

    parser.add_argument(
        '--list-archetypes', '-l',
        action='store_true',
        help='利用可能なアーキタイプを表示'
    )

    parser.add_argument(
        '--no-mod-update',
        action='store_true',
        help='mod.rsの自動更新をスキップ'
    )

    args = parser.parse_args()

    # アーキタイプ一覧表示
    if args.list_archetypes:
        print("Available Archetypes:")
        print("=" * 60)
        for archetype in list_archetypes():
            print(f"\n[{archetype['name']}]")
            print_archetype_info(archetype)
        print("\n" + "=" * 60)
        return

    # 必須引数チェック
    if not args.name or not args.description:
        parser.error("--name and --description are required")

    print(f"{'='*60}")
    print("Aegis Architect - Architecture Enforced Scaffolding")
    print(f"{'='*60}")
    print(f"Feature:   {args.name}")
    print(f"Archetype: {args.archetype}")
    print(f"Target:    {args.target}")
    print(f"{'='*60}\n")

    try:
        # マニフェスト読み込み（存在確認）
        manifest = load_archetype(args.archetype)
        print(f"Using archetype: {manifest['displayName']}")
        print(f"  {manifest['description']}\n")

        # スケルトン生成
        generated = scaffold_feature(
            args.name,
            args.description,
            args.archetype,
            args.target
        )

        print("Generated files:")
        for layer, path in generated.items():
            print(f"  [{layer.upper():8}] {path}")

        # mod.rs更新
        if not args.no_mod_update:
            updated = update_mod_files(args.target, args.name, args.archetype)
            if updated:
                print("\nUpdated mod.rs files:")
                for path in updated:
                    print(f"  {path}")

        print(f"\n{'='*60}")
        print("Architecture enforced successfully!")
        print(f"Created {len(generated)} files for feature '{args.name}'")
        print(f"{'='*60}")

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
