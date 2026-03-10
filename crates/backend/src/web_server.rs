use std::{
    net::{IpAddr, SocketAddr},
    path::PathBuf,
    sync::Arc,
};

use axum::{
    Json, Router,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use quasim::{
    circuit::Circuit,
    simulator::{BuildSimulator, RunnableSimulator},
    sv_simulator::{SVError, SVSimulator},
};
use serde::Serialize;
use tokio::net::TcpListener;
use tower_http::services::{ServeDir, ServeFile};

use crate::circuit_parse::{JsonParseError, SerializedCircuit};

#[derive(Clone)]
struct AppState {
    // ...
}

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

#[derive(Debug, thiserror::Error)]
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

#[derive(Debug, thiserror::Error)]
enum AppError {
    #[error("{0}")]
    SVError(#[from] SVError),
    #[error("{0}")]
    JsonParseError(#[from] JsonParseError),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = match self {
            AppError::JsonParseError(_) => StatusCode::BAD_REQUEST,
            AppError::SVError(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };

        (status, Json(self.to_string())).into_response()
    }
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
}

#[derive(Debug, Serialize)]
struct RunResponse {
    value: usize,
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
    // TODO shared state.. ?
    let shared_state = Arc::new(AppState { /* ... */ });

    let app = Router::new().nest(
        "/api",
        Router::new()
            .route("/health", get(health))
            .route("/run", post(run_circuit)),
    );

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

async fn run_circuit(
    Json(serialized_circuit): Json<SerializedCircuit>,
) -> Result<Json<RunResponse>, AppError> {
    let circuit = Circuit::try_from(serialized_circuit)?;
    let sim = SVSimulator::build(circuit)?;

    Ok(Json(RunResponse { value: sim.run() }))
}
