use std::sync::Arc;

use quasim::simulator::DebuggableSimulator;
use tokio::sync::{Mutex, MutexGuard};

// Session handle

pub struct DebugSession<T>(Arc<Mutex<T>>)
where
    T: DebuggableSimulator;

impl<T> Clone for DebugSession<T>
where
    T: DebuggableSimulator,
{
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

impl<T> From<T> for DebugSession<T>
where
    T: DebuggableSimulator,
{
    fn from(value: T) -> Self {
        DebugSession::new(value)
    }
}

impl<T> DebugSession<T>
where
    T: DebuggableSimulator,
{
    pub fn new(debugger: T) -> Self {
        Self(Arc::new(Mutex::new(debugger)))
    }

    pub async fn debugger(&self) -> MutexGuard<'_, T> {
        self.0.lock().await
    }
}
