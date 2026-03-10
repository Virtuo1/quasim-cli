use std::{
    net::{IpAddr, Ipv4Addr},
    path::PathBuf,
};

use anyhow::{Context, Result, bail};
use clap::{Parser, Subcommand};
use quasim::{circuit::Circuit, debug_terminal::DebugTerminal, sv_simulator::SVSimulatorDebugger};
use quasim_backend::web_server::{ServerOptions, run_server};

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
            api_only,
            open_browser,
        } => {
            let static_dir = resolve_static_dir(frontend_dist, api_only)?;
            let url = format!("http://{}:{}", host, port);
            println!("starting quasim backend at {url}");

            if open_browser && !api_only {
                webbrowser::open(&url).context("failed to open browser")?;
            }

            run_server(ServerOptions {
                host,
                port,
                static_dir,
            })
            .await
            .map_err(Into::into)
        }

        Command::Debug { circuit_file } => {
            let test_circ = Circuit::new(3).h(0).cx(&[0], 2).cx(&[2], 1);

            let mut term = DebugTerminal::<SVSimulatorDebugger>::new(test_circ)
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
