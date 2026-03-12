use std::collections::HashMap;

use quasim::{expr_dsl::Value, simulator::HybridSimulator};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::api::debug_session::DebugSessionState;
use nalgebra::{Complex, DVector};

// Helper types

#[derive(Debug, Serialize)]
pub struct ComplexAmplitude {
    re: f64,
    im: f64,
}

impl From<Complex<f64>> for ComplexAmplitude {
    fn from(value: Complex<f64>) -> Self {
        Self {
            re: value.re,
            im: value.im,
        }
    }
}

impl ComplexAmplitude {
    pub fn norm_sqr(&self) -> f64 {
        self.re * self.re + self.im * self.im
    }
}

#[derive(Debug, Serialize)]
pub struct StateVector {
    amplitudes: Vec<ComplexAmplitude>,
}

impl From<DVector<Complex<f64>>> for StateVector {
    fn from(value: DVector<Complex<f64>>) -> Self {
        let amplitudes = value.iter().map(|&amp| amp.into()).collect();

        Self { amplitudes }
    }
}

#[derive(Debug, Serialize)]
pub struct IndexedAmplitude {
    basis: usize,
    amplitude: ComplexAmplitude,
}

impl IndexedAmplitude {
    pub fn new(basis: usize, amplitude: ComplexAmplitude) -> Self {
        Self { basis, amplitude }
    }

    pub fn amplitude(&self) -> &ComplexAmplitude {
        &self.amplitude
    }
}

// Query types

#[derive(Debug, Deserialize)]
pub struct StateVectorQuery {
    top_n: Option<usize>,
    nonzero: Option<bool>,
}

// Response types

#[derive(Debug, Serialize)]
pub struct BuildResponse {
    session_id: Uuid,
}

impl BuildResponse {
    pub fn from_parts(session_id: Uuid) -> Self {
        Self { session_id }
    }
}

#[derive(Debug, Serialize)]
pub struct StateResponse {
    pc: usize,
    state: DebugSessionState,
}

impl StateResponse {
    pub fn from_parts(pc: usize, state: DebugSessionState) -> Self {
        Self { pc, state }
    }
}

#[derive(Debug, Serialize)]
pub struct StateVectorResponse {
    amplitudes: Vec<IndexedAmplitude>,
    total_amplitudes: usize,
    filtered: bool,
}

impl StateVectorResponse {
    fn is_zero_amp(z: &Complex<f64>) -> bool {
        const EPS: f64 = 1e-12;
        z.norm_sqr() < EPS * EPS
    }

    pub fn from_parts(state_vector: &DVector<Complex<f64>>, query: StateVectorQuery) -> Self {
        let total_amplitudes = state_vector.len();
        let mut filtered = false;

        let mut amplitudes: Vec<IndexedAmplitude> = state_vector
            .iter()
            .enumerate()
            .filter(|(_, amp)| !query.nonzero.unwrap_or(false) || !Self::is_zero_amp(amp))
            .map(|(basis, amp)| IndexedAmplitude::new(basis, (*amp).into()))
            .collect();

        if query.nonzero.unwrap_or(false) {
            filtered = true;
        }

        if let Some(top_n) = query.top_n {
            amplitudes.sort_by(|a, b| {
                let a_norm = a.amplitude().norm_sqr();
                let b_norm = b.amplitude().norm_sqr();
                b_norm.total_cmp(&a_norm)
            });
            if amplitudes.len() > top_n {
                amplitudes.truncate(top_n);
                filtered = true;
            }
        }

        Self {
            amplitudes,
            total_amplitudes,
            filtered,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct BasisResponse {
    amplitude: ComplexAmplitude,
}

impl BasisResponse {
    pub fn from_parts(amplitude: ComplexAmplitude) -> Self {
        Self {
            amplitude: amplitude,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct RegistersResponse {
    registers: HashMap<String, Value>,
}

impl RegistersResponse {
    pub fn from_parts<T: HybridSimulator<Value>>(hybrid_sim: &T) -> Self {
        Self {
            registers: hybrid_sim.registers().into(),
        }
    }
}
