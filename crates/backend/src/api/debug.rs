use axum::{Json, Router, extract::State, routing::post};
use serde::Serialize;
use uuid::Uuid;

use crate::{
    api::{APIError, BackendDebugger, DebugSession, SharedState},
    circuit_parse::SerializedCircuit,
};

pub mod session;

/* /api/debug

POST /api/debug/build

*/

#[derive(Debug, Serialize)]
struct BuildResponse {
    id: Uuid,
}

pub fn debug_router<T: BackendDebugger>(state: SharedState<T>) -> Router {
    Router::<SharedState<T>>::new()
        .route("/build", post(debug_build::<T>))
        .nest("/{uuid}", session::session_router::<T>())
        .with_state(state)
}

async fn debug_build<T: BackendDebugger>(
    State(state): State<SharedState<T>>,
    Json(serialized_circuit): Json<SerializedCircuit>,
) -> Result<Json<BuildResponse>, APIError> {
    let circuit = quasim::circuit::Circuit::try_from(serialized_circuit)?;
    let debugger = T::build(circuit).map_err(|err| APIError::BuildError(err.to_string()))?;
    let session_uuid = Uuid::new_v4();

    let mut state = state.lock().await;
    state
        .sessions
        .insert(session_uuid, DebugSession::from(debugger));

    Ok(Json(BuildResponse { id: session_uuid }))
}
