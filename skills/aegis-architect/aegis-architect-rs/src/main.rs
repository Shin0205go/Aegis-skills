//! Aegis Architect - Architecture Enforcing Scaffold Tool
//!
//! RustでRustを生成する。これがメタプログラミング。

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use colored::Colorize;
use heck::ToPascalCase;
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};
use tera::Tera;

/// Aegis Architect - アーキタイプベースのスキャフォールドツール
#[derive(Parser)]
#[command(name = "aegis-architect")]
#[command(about = "プロジェクトの重さに応じた型を選択してスキャフォールドを生成")]
#[command(version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// アーキタイプディレクトリのパス
    #[arg(long, global = true)]
    archetypes_dir: Option<PathBuf>,
}

#[derive(Subcommand)]
enum Commands {
    /// 新機能のスキャフォールドを生成
    Scaffold {
        /// 機能名（snake_case推奨）
        #[arg(short, long)]
        name: String,

        /// 機能の説明
        #[arg(short, long)]
        description: String,

        /// アーキタイプ（デフォルト: rust_hexagonal）
        #[arg(short, long, default_value = "rust_hexagonal")]
        archetype: String,

        /// 生成先ディレクトリ
        #[arg(short, long, default_value = ".")]
        target: PathBuf,

        /// mod.rsの自動更新をスキップ
        #[arg(long)]
        no_mod_update: bool,
    },

    /// 利用可能なアーキタイプ一覧を表示
    List,
}

/// アーキタイプのマニフェスト
#[derive(Debug, Deserialize)]
struct Manifest {
    name: String,
    #[serde(rename = "displayName")]
    display_name: String,
    description: String,
    #[serde(default)]
    use_when: Vec<String>,
    #[serde(default)]
    avoid_when: Vec<String>,
    files: Vec<FileSpec>,
}

/// 生成ファイルの仕様
#[derive(Debug, Deserialize)]
struct FileSpec {
    template: String,
    output: String,
    layer: String,
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    // アーキタイプディレクトリを決定
    let archetypes_dir = cli.archetypes_dir.unwrap_or_else(|| {
        // 実行ファイルと同じディレクトリ、または親ディレクトリのarchetypesを探す
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()));

        if let Some(dir) = exe_dir {
            let candidate = dir.join("archetypes");
            if candidate.exists() {
                return candidate;
            }
            // 親ディレクトリも探す
            if let Some(parent) = dir.parent() {
                let candidate = parent.join("archetypes");
                if candidate.exists() {
                    return candidate;
                }
            }
        }

        // フォールバック: カレントディレクトリ
        PathBuf::from("archetypes")
    });

    match cli.command {
        Commands::List => list_archetypes(&archetypes_dir),
        Commands::Scaffold {
            name,
            description,
            archetype,
            target,
            no_mod_update,
        } => scaffold_feature(
            &archetypes_dir,
            &name,
            &description,
            &archetype,
            &target,
            !no_mod_update,
        ),
    }
}

/// アーキタイプ一覧を表示
fn list_archetypes(archetypes_dir: &Path) -> Result<()> {
    println!("{}", "Available Archetypes:".bold());
    println!("{}", "=".repeat(60));

    let archetypes = load_all_archetypes(archetypes_dir)?;

    for manifest in archetypes {
        println!("\n[{}]", manifest.name.cyan());
        println!("\n  {}", manifest.display_name.bold());
        println!("  {}", manifest.description);

        if !manifest.use_when.is_empty() {
            println!("\n  {}:", "Use when".green());
            for item in &manifest.use_when {
                println!("    - {}", item);
            }
        }

        if !manifest.avoid_when.is_empty() {
            println!("\n  {}:", "Avoid when".red());
            for item in &manifest.avoid_when {
                println!("    - {}", item);
            }
        }
    }

    println!("\n{}", "=".repeat(60));
    Ok(())
}

/// 全アーキタイプを読み込む
fn load_all_archetypes(archetypes_dir: &Path) -> Result<Vec<Manifest>> {
    let mut result = Vec::new();

    for entry in fs::read_dir(archetypes_dir)
        .with_context(|| format!("Failed to read archetypes directory: {:?}", archetypes_dir))?
    {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            let manifest_path = path.join("manifest.json");
            if manifest_path.exists() {
                let content = fs::read_to_string(&manifest_path)?;
                let manifest: Manifest = serde_json::from_str(&content)
                    .with_context(|| format!("Failed to parse manifest: {:?}", manifest_path))?;
                result.push(manifest);
            }
        }
    }

    // 名前でソート
    result.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(result)
}

/// アーキタイプを読み込む
fn load_archetype(archetypes_dir: &Path, name: &str) -> Result<Manifest> {
    let manifest_path = archetypes_dir.join(name).join("manifest.json");

    if !manifest_path.exists() {
        let available: Vec<_> = load_all_archetypes(archetypes_dir)?
            .iter()
            .map(|m| m.name.clone())
            .collect();

        anyhow::bail!(
            "Archetype '{}' not found. Available: {}",
            name,
            available.join(", ")
        );
    }

    let content = fs::read_to_string(&manifest_path)?;
    let manifest: Manifest = serde_json::from_str(&content)?;
    Ok(manifest)
}

/// スキャフォールドを生成
fn scaffold_feature(
    archetypes_dir: &Path,
    name: &str,
    description: &str,
    archetype: &str,
    target: &Path,
    update_mod: bool,
) -> Result<()> {
    // 名前を正規化
    let snake_name = to_snake_case(name);
    let pascal_name = snake_name.to_pascal_case();

    println!("{}", "=".repeat(60));
    println!(
        "{}",
        "Aegis Architect - Architecture Enforced Scaffolding".bold()
    );
    println!("{}", "=".repeat(60));
    println!("Feature:   {}", snake_name.cyan());
    println!("Archetype: {}", archetype.cyan());
    println!("Target:    {}", target.display().to_string().cyan());
    println!("{}\n", "=".repeat(60));

    // マニフェスト読み込み
    let manifest = load_archetype(archetypes_dir, archetype)?;
    println!(
        "Using archetype: {}",
        manifest.display_name.bold()
    );
    println!("  {}\n", manifest.description);

    // Teraコンテキスト作成
    let mut context = tera::Context::new();
    context.insert("name", &snake_name);
    context.insert("pascal_name", &pascal_name);
    context.insert("description", description);

    // ファイル生成
    let archetype_dir = archetypes_dir.join(archetype);
    let mut generated = Vec::new();

    println!("Generated files:");

    for file_spec in &manifest.files {
        // テンプレート読み込み
        let template_path = archetype_dir.join(&file_spec.template);
        let template_content = fs::read_to_string(&template_path)
            .with_context(|| format!("Failed to read template: {:?}", template_path))?;

        // Teraでレンダリング
        let rendered = Tera::one_off(&template_content, &context, false)
            .with_context(|| format!("Failed to render template: {}", file_spec.template))?;

        // 出力パスを生成（変数置換）
        let output_path = file_spec
            .output
            .replace("{{name}}", &snake_name)
            .replace("{{pascal_name}}", &pascal_name);

        let full_path = target.join(&output_path);

        // ディレクトリ作成
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // ファイル書き込み
        fs::write(&full_path, rendered)?;

        println!(
            "  [{}] {}",
            file_spec.layer.to_uppercase().green(),
            full_path.display()
        );
        generated.push((file_spec.layer.clone(), full_path));
    }

    // mod.rs更新（rust_hexagonalのみ）
    if update_mod && archetype == "rust_hexagonal" {
        let updated = update_mod_files(target, &snake_name)?;
        if !updated.is_empty() {
            println!("\nUpdated mod.rs files:");
            for path in updated {
                println!("  {}", path.display());
            }
        }
    }

    println!("\n{}", "=".repeat(60));
    println!(
        "{}",
        format!(
            "Architecture enforced successfully! Created {} files for feature '{}'",
            generated.len(),
            snake_name
        )
        .green()
        .bold()
    );
    println!("{}", "=".repeat(60));

    Ok(())
}

/// mod.rsファイルを更新
fn update_mod_files(target: &Path, name: &str) -> Result<Vec<PathBuf>> {
    let mut updated = Vec::new();

    let mod_files = [
        (target.join("src/domain/mod.rs"), format!("pub mod {};", name)),
        (
            target.join("src/ports/mod.rs"),
            format!("pub mod {}_port;", name),
        ),
        (
            target.join("src/adapters/mod.rs"),
            format!("pub mod {}_adapter;", name),
        ),
    ];

    for (mod_path, mod_line) in mod_files {
        let mod_line_with_newline = format!("{}\n", mod_line);

        if mod_path.exists() {
            let content = fs::read_to_string(&mod_path)?;
            if !content.contains(&mod_line) {
                let mut file = fs::OpenOptions::new().append(true).open(&mod_path)?;
                std::io::Write::write_all(&mut file, mod_line_with_newline.as_bytes())?;
                updated.push(mod_path);
            }
        } else {
            if let Some(parent) = mod_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::write(&mod_path, mod_line_with_newline)?;
            updated.push(mod_path);
        }
    }

    Ok(updated)
}

/// snake_caseに変換
fn to_snake_case(name: &str) -> String {
    name.to_lowercase()
        .replace('-', "_")
        .replace(' ', "_")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_to_snake_case() {
        assert_eq!(to_snake_case("MyFeature"), "myfeature");
        assert_eq!(to_snake_case("my-feature"), "my_feature");
        assert_eq!(to_snake_case("my feature"), "my_feature");
    }

    #[test]
    fn test_pascal_case() {
        assert_eq!("stock_price".to_pascal_case(), "StockPrice");
        assert_eq!("market_analysis".to_pascal_case(), "MarketAnalysis");
    }
}
