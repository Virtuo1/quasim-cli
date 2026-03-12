use std::{
    net::{IpAddr, Ipv4Addr},
    path::PathBuf,
};

use anyhow::{Context, Result, bail};
use clap::{Parser, Subcommand};
use quasim::{circuit::Circuit, debug_terminal::DebugTerminal, sv_simulator::SVSimulatorDebugger};
use quasim_backend::web_server::{ServerOptions, run_server};
use quasim_backend::{api::APIConfig, circuit_parse::SerializedCircuit};

#[derive(Debug, Parser)]
#[command(name = "quasim-cli")]
#[command(version, about = "CLI entrypoint for the Quasim Web GUI")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Start the HTTP backend and optionally serve the built web GUI.
    Gui {
        #[arg(long, default_value_t = IpAddr::V4(Ipv4Addr::LOCALHOST))]
        host: IpAddr,
        #[arg(long, default_value_t = 8787)]
        port: u16,
        #[arg(long)]
        frontend_dist: Option<PathBuf>,
        #[arg(long, default_value_t = 16)]
        max_qubits: usize,
        #[arg(long, default_value_t = false)]
        api_only: bool,
        #[arg(long, default_value_t = false)]
        open_browser: bool,
    },
    /// Start the debug terminal
    Debug {
        #[arg(long)]
        circuit_file: Option<PathBuf>,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Command::Gui {
            host,
            port,
            frontend_dist,
            max_qubits,
            api_only,
            open_browser,
        } => {
            let static_dir = resolve_static_dir(frontend_dist, api_only)?;
            let url = format!("http://{}:{}", host, port);
            println!("starting quasim backend at {url}");

            if open_browser && !api_only {
                webbrowser::open(&url).context("failed to open browser")?;
            }

            run_server(
                ServerOptions {
                    host,
                    port,
                    static_dir,
                },
                APIConfig {
                    max_qubits: Some(max_qubits),
                },
            )
            .await
            .map_err(Into::into)
        }

        Command::Debug { circuit_file } => {
            let circuit = match circuit_file {
                Some(path) => {
                    let path_display = path.display().to_string();
                    let serialized = SerializedCircuit::from_json_file(
                        path.to_str()
                            .context("circuit file path must be valid UTF-8")?,
                    )
                    .with_context(|| {
                        format!("failed to load serialized circuit from {path_display}")
                    })?;
                    serialized.into_circuit().with_context(|| {
                        format!("failed to convert serialized circuit from {path_display}")
                    })?
                }
                None => Circuit::new(0).into(),
            };

            let mut term = DebugTerminal::<SVSimulatorDebugger>::new(circuit)
                .expect("Test could not build debug terminal");

            term.run().map_err(Into::into)
        }
    }
}

fn resolve_static_dir(frontend_dist: Option<PathBuf>, api_only: bool) -> Result<Option<PathBuf>> {
    if api_only {
        return Ok(None);
    }

    let root = workspace_root()?;
    let dist_dir =
        frontend_dist.unwrap_or_else(|| root.join("web").join("circuit-builder").join("dist"));
    if !dist_dir.exists() {
        bail!(
            "frontend dist directory not found at {}. Run `npm run build` first or use `--api-only`.",
            dist_dir.display()
        );
    }

    Ok(Some(dist_dir))
}

fn workspace_root() -> Result<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .and_then(|path| path.parent())
        .map(PathBuf::from)
        .context("failed to resolve workspace root")
}
