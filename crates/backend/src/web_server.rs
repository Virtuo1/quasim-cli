use std::{
    net::{IpAddr, SocketAddr},
    path::PathBuf,
};

use axum::{
    Router,
    body::Body,
    http::{
        HeaderValue, StatusCode, Uri,
        header::CONTENT_TYPE,
    },
    response::{IntoResponse, Response},
};
use quasim::sv_simulator::SVSimulatorDebugger;
use tokio::net::TcpListener;
use tower_http::services::{ServeDir, ServeFile};

use crate::api::{APIConfig, api_router};

mod embedded_frontend {
    include!(concat!(env!("OUT_DIR"), "/embedded_frontend.rs"));
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

pub async fn run_server(options: ServerOptions, config: APIConfig) -> Result<(), BackendError> {
    let listener = TcpListener::bind(options.socket_addr())
        .await
        .map_err(|source| BackendError::Bind {
            addr: options.socket_addr(),
            source,
        })?;

    let app = build_app(options.static_dir, config);

    axum::serve(listener, app)
        .await
        .map_err(BackendError::Serve)
}

fn build_app(static_dir: Option<PathBuf>, config: APIConfig) -> Router {
    let app = Router::new().nest("/api", api_router::<SVSimulatorDebugger>(config));

    if let Some(dir) = static_dir {
        let index_path = dir.join("index.html");
        return app.fallback_service(ServeDir::new(dir).not_found_service(ServeFile::new(index_path)));
    }

    if cfg!(debug_assertions) {
        app
    } else {
        app.fallback(serve_embedded_frontend)
    }
}

async fn serve_embedded_frontend(uri: Uri) -> Response {
    let asset_path = match uri.path().trim_start_matches('/') {
        "" => "index.html",
        path => path,
    };

    let asset = embedded_frontend::EMBEDDED_ASSETS
        .iter()
        .find(|asset| asset.path == asset_path)
        .or_else(|| {
            embedded_frontend::EMBEDDED_ASSETS
                .iter()
                .find(|asset| asset.path == "index.html")
        });

    match asset {
        Some(asset) => {
            let mut response = Response::new(Body::from(asset.bytes));
            response
                .headers_mut()
                .insert(CONTENT_TYPE, HeaderValue::from_static(asset.content_type));
            response
        }
        None => StatusCode::NOT_FOUND.into_response(),
    }
}
