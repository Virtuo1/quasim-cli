use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{delete, post},
};
use uuid::Uuid;

use crate::{
    api::{APIError, BackendDebugger, DebugSession, SharedState, types::BuildResponse},
    circuit_parse::SerializedCircuit,
};

pub mod session;

/* /api/debug

POST /api/debug/build

*/

pub fn debug_router<T: BackendDebugger>(state: SharedState<T>) -> Router {
    Router::<SharedState<T>>::new()
        .route("/build", post(debug_build))
        .route("/{uuid}", delete(debug_destroy))
        .nest("/{session_id}", session::session_router())
        .with_state(state)
}

// POST /api/debug/build
async fn debug_build<T: BackendDebugger>(
    State(state): State<SharedState<T>>,
    Json(serialized_circuit): Json<SerializedCircuit>,
) -> Result<Json<BuildResponse>, APIError> {
    let circuit = serialized_circuit.into_circuit()?;
    let debugger = T::build(circuit).map_err(|err| APIError::BuildError(err.to_string()))?;
    let session_id = Uuid::new_v4();

    let mut state = state.lock().await;
    state
        .sessions
        .insert(session_id, DebugSession::from(debugger));

    Ok(Json(BuildResponse::from_parts(session_id)))
}

// DELETE /api/debug/{uuid}
async fn debug_destroy<T: BackendDebugger>(
    Path(session_id): Path<Uuid>,
    State(state): State<SharedState<T>>,
) -> Result<Response, APIError> {
    let mut state = state.lock().await;
    state
        .sessions
        .remove(&session_id)
        .ok_or(APIError::SessionNotFound)?;

    Ok(StatusCode::NO_CONTENT.into_response())
}
