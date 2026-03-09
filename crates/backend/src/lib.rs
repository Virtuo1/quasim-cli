use std::{
    net::{IpAddr, SocketAddr},
    path::PathBuf,
};

use axum::{Json, Router, response::IntoResponse, routing::get};
use serde::Serialize;
use thiserror::Error;
use tokio::net::TcpListener;
use tower_http::services::{ServeDir, ServeFile};

#[derive(Clone)]
pub struct AppState;

#[derive(Debug, Clone)]
pub struct ServerOptions {
    pub host: IpAddr,
    pub port: u16,
    pub static_dir: Option<PathBuf>,
}

impl ServerOptions {
    pub fn socket_addr(&self) -> SocketAddr {
        SocketAddr::from((self.host, self.port))
    }
}

#[derive(Debug, Error)]
pub enum BackendError {
    #[error("failed to bind {addr}: {source}")]
    Bind {
        addr: SocketAddr,
        #[source]
        source: std::io::Error,
    },
    #[error("backend server exited unexpectedly: {0}")]
    Serve(#[source] std::io::Error),
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
}

pub async fn run_server(options: ServerOptions) -> Result<(), BackendError> {
    let listener = TcpListener::bind(options.socket_addr())
        .await
        .map_err(|source| BackendError::Bind {
            addr: options.socket_addr(),
            source,
        })?;

    let app = build_app(options.static_dir);

    axum::serve(listener, app)
        .await
        .map_err(BackendError::Serve)
}

fn build_app(static_dir: Option<PathBuf>) -> Router {
    let app = Router::new().nest("/api", Router::new().route("/health", get(health)));

    match static_dir {
        Some(dir) => {
            let index_path = dir.join("index.html");
            app.fallback_service(ServeDir::new(dir).not_found_service(ServeFile::new(index_path)))
        }
        None => app,
    }
}

async fn health() -> impl IntoResponse {
    Json(HealthResponse { status: "ok" })
}
