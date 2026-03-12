use std::{collections::HashMap, sync::Arc};

use axum::{
    Json, Router,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
};
use quasim::{
    circuit::{Circuit, HybridCircuit},
    simulator::{
        BuildSimulator, DebuggableSimulator, HybridSimulator, RunnableSimulator,
        StoredCircuitSimulator,
    },
    sv_simulator::{SVError, SVSimulator},
};
use serde::Serialize;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::{
    api::debug_session::DebugSession,
    circuit_parse::{JsonParseError, SerializedCircuit},
};

pub mod debug;
pub mod debug_session;
pub mod types;

#[derive(Debug, thiserror::Error)]
pub enum APIError {
    #[error("{0}")]
    RunError(#[from] SVError),
    #[error("{0}")]
    JsonParseError(#[from] JsonParseError),
    #[error("failed to build debugger: {0}")]
    BuildError(String),
    #[error("debug session not found")]
    SessionNotFound,
    #[error("tried to get unavailable basis {0:b}")]
    UnavailableBasis(usize),
}

impl IntoResponse for APIError {
    fn into_response(self) -> Response {
        let status = match self {
            APIError::JsonParseError(_) => StatusCode::BAD_REQUEST,
            APIError::BuildError(_) => StatusCode::BAD_REQUEST,
            APIError::SessionNotFound => StatusCode::NOT_FOUND,
            APIError::RunError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            APIError::UnavailableBasis(_) => StatusCode::BAD_REQUEST,
        };

        (status, Json(self.to_string())).into_response()
    }
}

#[derive(Debug, Serialize)]
struct RunResponse {
    value: usize,
}

pub trait BackendDebugger:
    BuildSimulator<HybridCircuit>
    + DebuggableSimulator
    + HybridSimulator<quasim::expr_dsl::Value>
    + StoredCircuitSimulator
    + Send
    + 'static
{
}

impl<T> BackendDebugger for T where
    T: BuildSimulator<HybridCircuit>
        + DebuggableSimulator
        + HybridSimulator<quasim::expr_dsl::Value>
        + StoredCircuitSimulator
        + Send
        + 'static
{
}

#[derive(Debug, Clone)]
pub struct APIConfig {
    pub max_qubits: Option<usize>,
}

#[derive(Clone)]
pub struct APIStore<T: BackendDebugger> {
    pub sessions: HashMap<Uuid, DebugSession<T>>,
    pub config: APIConfig,
}

pub type SharedState<T> = Arc<Mutex<APIStore<T>>>;

async fn run_circuit(
    Json(serialized_circuit): Json<SerializedCircuit>,
) -> Result<Json<RunResponse>, APIError> {
    let circuit: Circuit<HybridCircuit> = serialized_circuit.into_circuit()?;
    let sim = SVSimulator::build(circuit.clone())?;

    Ok(Json(RunResponse { value: sim.run() }))
}

pub fn api_router<T: BackendDebugger>(config: APIConfig) -> Router {
    let state: SharedState<T> = Arc::new(Mutex::new(APIStore {
        sessions: HashMap::new(),
        config,
    }));

    Router::new()
        .route("/run", post(run_circuit))
        .nest("/debug", debug::debug_router(state.clone()))
}
