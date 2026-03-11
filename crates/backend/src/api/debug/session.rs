use std::collections::HashMap;

use axum::{
    Json, Router,
    extract::{FromRequestParts, Path},
    http::request::Parts,
    response::IntoResponse,
    routing::get,
};
use quasim::expr_dsl::Value;
use serde::Serialize;
use uuid::Uuid;

use crate::{api::{APIError, BackendDebugger, DebugSession, SharedState}, util::{ComplexAmplitude, IndexedAmplitude, StateVector}};

/* /api/debug/{session_uuid}

DELETE /api/debug/{session_uuid}

GET /api/debug/{session_uuid}/state

GET /api/debug/{session_uuid}/statevector?top_n={num}?nonzero={bool}
GET /api/debug/{session_uuid}/statevector/{basis}
GET /api/debug/{session_uuid}/registers

POST /api/debug/{session_uuid}/next
POST /api/debug/{session_uuid}/continue
POST /api/debug/{session_uuid}/reset
    => Returns state

GET /api/debug/{session_uuid}/breakpoints
POST /api/debug/{session_uuid}/breakpoints
DELETE /api/debug/{session_uuid}/breakpoints/{step}

*/

#[derive(Debug, Serialize)]
pub struct StateResponse {
    id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct StateVectorResponse {
    amplitudes: Vec<IndexedAmplitude>,
    total_amplitudes: usize,
    filtered: bool,
}

#[derive(Debug, Serialize)]
pub struct BasisResponse {
    basis: ComplexAmplitude,
}

#[derive(Debug, Serialize)]
pub struct RegistersResponse {
    registers: HashMap<String, Value>,
}

pub fn session_router<T: BackendDebugger>() -> Router<SharedState<T>> {
    Router::new().route("/state", get(session_state::<T>))
}

impl<T> FromRequestParts<SharedState<T>> for DebugSession<T>
where
    T: BackendDebugger,
{
    type Rejection = APIError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &SharedState<T>,
    ) -> Result<Self, Self::Rejection> {
        let Path(uuid) = Path::<Uuid>::from_request_parts(parts, state)
            .await
            .map_err(|_| APIError::SessionNotFound)?;

        let state = state.lock().await;
        state
            .sessions
            .get(&uuid)
            .cloned()
            .ok_or(APIError::SessionNotFound)
    }
}

// GET /api/debug/{session_uuid}/state
async fn session_state<T: BackendDebugger>(
    Path(uuid): Path<Uuid>,
    session: DebugSession<T>,
) -> Result<impl IntoResponse, APIError> {
    let _debugger = session.debugger().await;
    Ok(Json(StateResponse { id: uuid }))
}

// GET /api/debug/{session_uuid}/statevector?top_n={num}?nonzero={bool}
async fn session_statevector<T: BackendDebugger>(session: DebugSession<T>) -> Result<impl IntoResponse, APIError> {
    let _debugger = session.debugger().await;

    Ok(Json(""))
}

// GET /api/debug/{session_uuid}/statevector/{basis}
async fn session_statevector_basis<T: BackendDebugger>(session: DebugSession<T>) -> Result<impl IntoResponse, APIError> {
    Ok(Json(()))
}
// GET /api/debug/{session_uuid}/registers
async fn session_registers<T: BackendDebugger>(session: DebugSession<T>) -> Result<impl IntoResponse, APIError> {
    Ok(Json(()))
}

// POST /api/debug/{session_uuid}/next
async fn session_next<T: BackendDebugger>(session: DebugSession<T>) -> Result<impl IntoResponse, APIError> {
    Ok(Json(()))
}

// POST /api/debug/{session_uuid}/continue
async fn session_continue<T: BackendDebugger>(session: DebugSession<T>) -> Result<impl IntoResponse, APIError> {
    Ok(Json(()))
}

// POST /api/debug/{session_uuid}/reset
// async fn session_reset<T>(session: DebugSession<T>) -> Result<impl IntoResponse, APIError> {
    
// }
