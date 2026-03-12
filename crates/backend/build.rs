use std::{
    env,
    fmt::Write as _,
    fs,
    path::{Path, PathBuf},
    process::Command,
};

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("missing manifest dir"));
    let workspace_root = manifest_dir
        .parent()
        .and_then(|path| path.parent())
        .expect("failed to resolve workspace root");
    let frontend_dir = workspace_root.join("web").join("circuit-builder");
    let dist_dir = frontend_dir.join("dist");
    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("missing OUT_DIR"));

    emit_rerun_if_changed(&frontend_dir);
    ensure_frontend_dependencies(&frontend_dir);
    build_frontend(&frontend_dir);
    generate_embedded_assets(&dist_dir, &out_dir);
}

fn emit_rerun_if_changed(frontend_dir: &Path) {
    for path in walk_files(frontend_dir) {
        println!("cargo:rerun-if-changed={}", path.display());
    }
}

fn ensure_frontend_dependencies(frontend_dir: &Path) {
    if frontend_dir.join("node_modules").exists() {
        return;
    }

    let npm_args = if frontend_dir.join("package-lock.json").exists() {
        ["ci"]
    } else {
        ["install"]
    };

    let status = Command::new("npm")
        .args(npm_args)
        .current_dir(frontend_dir)
        .status()
        .expect("failed to install frontend dependencies");

    assert!(
        status.success(),
        "frontend dependency installation failed with status {status}"
    );
}

fn build_frontend(frontend_dir: &Path) {
    let status = Command::new("npm")
        .args(["run", "build"])
        .current_dir(frontend_dir)
        .status()
        .expect("failed to run `npm run build` for web/circuit-builder");

    assert!(status.success(), "frontend build failed with status {status}");
}

fn generate_embedded_assets(dist_dir: &Path, out_dir: &Path) {
    let mut assets = walk_files(dist_dir);
    assets.sort();

    let mut source = String::new();
    source.push_str("pub struct EmbeddedAsset {\n");
    source.push_str("    pub path: &'static str,\n");
    source.push_str("    pub content_type: &'static str,\n");
    source.push_str("    pub bytes: &'static [u8],\n");
    source.push_str("}\n\n");
    source.push_str("pub static EMBEDDED_ASSETS: &[EmbeddedAsset] = &[\n");

    for asset in assets {
        let rel = asset
            .strip_prefix(dist_dir)
            .expect("asset should be inside dist dir")
            .to_string_lossy()
            .replace('\\', "/");
        let content_type = content_type_for(&asset);
        let abs = asset.canonicalize().expect("failed to canonicalize asset path");
        writeln!(
            source,
            "    EmbeddedAsset {{ path: {:?}, content_type: {:?}, bytes: include_bytes!({:?}) }},",
            rel,
            content_type,
            abs.to_string_lossy()
        )
        .expect("failed to write generated asset source");
    }

    source.push_str("];\n");

    fs::write(out_dir.join("embedded_frontend.rs"), source)
        .expect("failed to write embedded frontend module");
}

fn walk_files(dir: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();

    if !dir.exists() {
        return files;
    }

    for entry in fs::read_dir(dir).expect("failed to read directory") {
        let entry = entry.expect("failed to read directory entry");
        let path = entry.path();
        if path.is_dir() {
            let name = entry.file_name();
            if name == "node_modules" || name == "dist" {
                continue;
            }
            files.extend(walk_files(&path));
        } else {
            files.push(path);
        }
    }

    files
}

fn content_type_for(path: &Path) -> &'static str {
    match path.extension().and_then(|ext| ext.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json") => "application/json",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("ico") => "image/x-icon",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("txt") => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}
