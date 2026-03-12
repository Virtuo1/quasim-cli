use std::sync::Arc;

use serde::Serialize;
use tokio::sync::Mutex;

use crate::api::{
    BackendDebugger,
    types::{
        BasisResponse, RegistersResponse, StateResponse, StateVectorQuery, StateVectorResponse,
    },
};

#[derive(Debug, Copy, Clone, Serialize)]
pub enum DebugSessionState {
    Paused,
    Running,
    Breakpoint,
    End,
}

struct SessionStore<T>
where
    T: BackendDebugger,
{
    debugger: T,
    state: DebugSessionState,
}

pub struct DebugSession<T>(Arc<Mutex<SessionStore<T>>>)
where
    T: BackendDebugger;

impl<T> Clone for DebugSession<T>
where
    T: BackendDebugger,
{
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

impl<T> From<T> for DebugSession<T>
where
    T: BackendDebugger,
{
    fn from(value: T) -> Self {
        DebugSession::new(value)
    }
}

impl<T> DebugSession<T>
where
    T: BackendDebugger,
{
    pub fn new(debugger: T) -> Self {
        Self(Arc::new(Mutex::new(SessionStore {
            debugger,
            state: DebugSessionState::Paused,
        })))
    }

    pub async fn state_response(&self) -> StateResponse {
        let session = self.0.lock().await;
        state_response_from_store(&session)
    }

    pub async fn state_vector_response(&self, query: StateVectorQuery) -> StateVectorResponse {
        let session = self.0.lock().await;
        let state_vector = session.debugger.current_state();

        StateVectorResponse::from_parts(state_vector, query)
    }

    pub async fn basis_response(&self, basis: usize) -> Option<BasisResponse> {
        let session = self.0.lock().await;
        let state_vector = session.debugger.current_state();

        if basis > state_vector.len() {
            return None;
        }

        Some(BasisResponse::from_parts(state_vector[basis].into()))
    }

    pub async fn registers_response(&self) -> RegistersResponse {
        let session = self.0.lock().await;

        RegistersResponse::from_parts(&session.debugger)
    }

    pub async fn next(&self) -> StateResponse {
        let mut session = self.0.lock().await;

        session.state = DebugSessionState::Running;
        session.debugger.next();
        session.state = DebugSessionState::Paused;

        state_response_from_store(&session)
    }

    pub async fn cont(&self) -> StateResponse {
        let mut session = self.0.lock().await;

        session.state = DebugSessionState::Running;
        session.debugger.cont();
        session.state = DebugSessionState::Paused;

        state_response_from_store(&session)
    }
}

/// Helper to extract state from SessionStore
fn state_response_from_store<T: BackendDebugger>(session: &SessionStore<T>) -> StateResponse {
    // If we are inside a subcircuit then circuit_pc will be "incorrect"
    // TODO fix this
    let (circuit_pc, _) = session.debugger.current_instruction();
    StateResponse::from_parts(circuit_pc.pc(), session.state)
}
