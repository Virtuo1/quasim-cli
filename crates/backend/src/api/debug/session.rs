use axum::{
    Json, Router,
    extract::{FromRequestParts, Path, Query},
    http::request::Parts,
    routing::get,
};
use uuid::Uuid;

use crate::api::{
    APIError, BackendDebugger, DebugSession, SharedState,
    types::{
        BasisResponse, RegistersResponse, StateResponse, StateVectorQuery, StateVectorResponse,
    },
};

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

pub fn session_router<T: BackendDebugger>() -> Router<SharedState<T>> {
    Router::new()
        .route("/state", get(session_state))
        .route("/statevector", get(session_statevector))
        .route("/statevector/{basis}", get(session_statevector_basis))
        .route("/registers", get(session_registers))
        .route("/next", get(session_next))
        .route("/continue", get(session_continue))
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
        let Path(session_id) = Path::<Uuid>::from_request_parts(parts, state)
            .await
            .map_err(|_| APIError::SessionNotFound)?;

        let state = state.lock().await;
        state
            .sessions
            .get(&session_id)
            .cloned()
            .ok_or(APIError::SessionNotFound)
    }
}

// GET /api/debug/{session_uuid}/state
async fn session_state<T: BackendDebugger>(
    session: DebugSession<T>,
) -> Result<Json<StateResponse>, APIError> {
    Ok(Json(session.state_response().await))
}

// GET /api/debug/{session_uuid}/statevector?top_n={num}&nonzero={bool}
async fn session_statevector<T: BackendDebugger>(
    Query(query): Query<StateVectorQuery>,
    session: DebugSession<T>,
) -> Result<Json<StateVectorResponse>, APIError> {
    Ok(Json(session.state_vector_response(query).await))
}

// GET /api/debug/{session_uuid}/statevector/{basis}
async fn session_statevector_basis<T: BackendDebugger>(
    Path(basis): Path<usize>,
    session: DebugSession<T>,
) -> Result<Json<BasisResponse>, APIError> {
    session
        .basis_response(basis)
        .await
        .ok_or(APIError::UnavailableBasis(basis))
        .map(Json)
}
// GET /api/debug/{session_uuid}/registers
async fn session_registers<T: BackendDebugger>(
    session: DebugSession<T>,
) -> Result<Json<RegistersResponse>, APIError> {
    Ok(Json(session.registers_response().await))
}

// GET /api/debug/{session_uuid}/next
async fn session_next<T: BackendDebugger>(
    session: DebugSession<T>,
) -> Result<Json<StateResponse>, APIError> {
    Ok(Json(session.next().await))
}

// GET /api/debug/{session_uuid}/continue
async fn session_continue<T: BackendDebugger>(
    session: DebugSession<T>,
) -> Result<Json<StateResponse>, APIError> {
    Ok(Json(session.cont().await))
}

// POST /api/debug/{session_uuid}/reset
// async fn session_reset<T>(session: DebugSession<T>) -> Result<impl IntoResponse, APIError> {

// }
