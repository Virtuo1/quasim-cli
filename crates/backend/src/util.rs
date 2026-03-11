use nalgebra::{Complex, DVector};
use serde::Serialize;

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