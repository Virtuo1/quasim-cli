use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs::read_to_string};

use quasim::{circuit::Circuit, expr_dsl::Expr, gate::GateError};

/// DTOs matching the client JSON export format exactly.
///
/// Example:
/// ```ignore
/// let circuit: SerializedCircuit = serde_json::from_str(json_str)?;
/// let json = serde_json::to_string_pretty(&circuit)?;
/// ```

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct SerializedCircuit {
    pub qubits: Option<usize>,
    pub steps: Option<usize>,
    #[serde(default)]
    pub classical_registers: Vec<String>,
    #[serde(default)]
    pub custom_gates: Vec<SerializedCustomGateDefinition>,
    #[serde(default)]
    pub instructions: Vec<InstructionDefinition>,
    #[serde(default)]
    pub conditions: Vec<SerializedCondition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SerializedCustomGateDefinition {
    pub classifier: String,
    #[serde(default)]
    pub gates: Vec<InstructionDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SerializedCondition {
    pub step: usize,
    pub expr: Expr,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(deny_unknown_fields)]
pub struct InstructionDefinition {
    pub step: usize,
    #[serde(rename = "type")]
    pub kind: OperationKind,
    #[serde(default)]
    pub qubit: Option<usize>,
    #[serde(default)]
    pub qubits: Option<Vec<usize>>,
    #[serde(default)]
    pub controls: Option<Vec<usize>>,
    #[serde(default)]
    pub params: Option<Vec<f64>>,
    #[serde(default)]
    pub creg: Option<String>,
    #[serde(default)]
    pub creg_bit: Option<usize>,
    #[serde(default)]
    pub classifier: Option<String>,
    #[serde(default)]
    pub target_step: Option<usize>,
    #[serde(default)]
    pub expr: Option<Expr>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OperationKind {
    H,
    X,
    Y,
    Z,
    S,
    #[serde(rename = "RX")]
    Rx,
    #[serde(rename = "RY")]
    Ry,
    #[serde(rename = "RZ")]
    Rz,
    P,
    U,
    I,
    #[serde(rename = "SWAP")]
    Swap,
    #[serde(rename = "M")]
    Measure,
    #[serde(rename = "ASSIGN")]
    Assign,
    #[serde(rename = "RESET")]
    Reset,
    #[serde(rename = "JUMP")]
    Jump,
    #[serde(rename = "CUSTOM")]
    Custom,
}

#[derive(Debug, thiserror::Error)]
pub enum JsonParseError {
    #[error("failed to read JSON file: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to deserialize circuit JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("missing required field `{field}` for operation {kind:?} at step {step}")]
    MissingField {
        kind: OperationKind,
        field: &'static str,
        step: usize,
    },
    #[error("unknown classical register `{name}`")]
    UnknownRegister { name: String },
    #[error("operation {kind:?} at step {step} is not supported yet")]
    UnsupportedOperation { kind: OperationKind, step: usize },
    #[error("invalid gate for operation {kind:?} at step {step}: {source}")]
    InvalidGate {
        kind: OperationKind,
        step: usize,
        #[source]
        source: GateError,
    },
    #[error("has unresolved jump label(s)")]
    UnresolvedLabel,
    #[error("duplicate condition on step {step}")]
    DuplicateCondition { step: usize },
}

impl SerializedCircuit {
    pub fn from_json_str(json: &str) -> Result<Self, JsonParseError> {
        Ok(serde_json::from_str(json)?)
    }

    pub fn from_json_file(file_name: &str) -> Result<Self, JsonParseError> {
        let file_string = read_to_string(file_name)?;
        Self::from_json_str(&file_string)
    }

    pub fn into_circuit(self) -> Result<Circuit, JsonParseError> {
        Circuit::try_from(self)
    }
}

impl TryFrom<SerializedCircuit> for Circuit {
    type Error = JsonParseError;

    fn try_from(value: SerializedCircuit) -> Result<Self, Self::Error> {
        let mut circuit = Circuit::new(value.qubits.unwrap_or_default());

        for reg in &value.classical_registers {
            circuit = circuit.new_reg(reg);
        }

        // Create map of step to every condition
        // Only one condition (Expr) is expected per step
        let mut step_to_condition = HashMap::<usize, Expr>::new();
        for condition in value.conditions {
            if step_to_condition
                .insert(condition.step, condition.expr)
                .is_some()
            {
                return Err(JsonParseError::DuplicateCondition {
                    step: condition.step,
                });
            }
        }

        let mut step = 0;
        let mut step_to_pc = HashMap::<usize, usize>::new();

        // Repeated code, remove and fix later maybe
        step_to_pc.insert(step, circuit.instructions().len());

        circuit = circuit.label(get_step_label(step));

        if let Some(expr) = step_to_condition.get(&0) {
            circuit = circuit.jump_if(expr.clone(), get_step_label(1))
        }

        for op in value.instructions {
            if op.step > step {
                step = op.step;

                step_to_pc.insert(step, circuit.instructions().len());

                circuit = circuit.label(get_step_label(step));

                if let Some(expr) = step_to_condition.get(&step) {
                    circuit = circuit.jump_if(expr.clone(), get_step_label(step + 1))
                }
            }

            circuit = match op.kind {
                OperationKind::H => apply_unitary(circuit, &op, Circuit::h, Circuit::ch)?,
                OperationKind::X => apply_unitary(circuit, &op, Circuit::x, Circuit::cx)?,
                OperationKind::Y => apply_unitary(circuit, &op, Circuit::y, Circuit::cy)?,
                OperationKind::Z => apply_unitary(circuit, &op, Circuit::z, Circuit::cz)?,
                OperationKind::S => apply_unitary(circuit, &op, Circuit::s, Circuit::cs)?,

                OperationKind::Rx => apply_param_unitary(circuit, &op, Circuit::rx, Circuit::crx)?,
                OperationKind::Ry => apply_param_unitary(circuit, &op, Circuit::ry, Circuit::cry)?,
                OperationKind::Rz => apply_param_unitary(circuit, &op, Circuit::rz, Circuit::crz)?,
                // TODO P gate
                OperationKind::U => {
                    let target = required_qubit(&op)?;
                    let params = required_params(&op, 3)?;

                    if let Some(controls) = &op.controls {
                        circuit.cu(params[0], params[1], params[2], controls, target)
                    } else {
                        circuit.u(params[0], params[1], params[2], target)
                    }
                }
                OperationKind::Swap => {
                    let targets = required_qubits(&op)?;

                    if let Some(controls) = &op.controls {
                        circuit.cswap(controls, targets[0], targets[1])
                    } else {
                        circuit.swap(targets[0], targets[1])
                    }
                }
                OperationKind::I => circuit, // Identity, do nothing

                OperationKind::Measure => {
                    let target = required_qubit(&op)?;
                    let creg = required_creg(&op)?;
                    let creg_bit = required_creg_bit(&op)?;

                    ensure_register(&circuit, creg)?;
                    circuit.measure_bit(target, (creg, creg_bit))
                }
                OperationKind::Assign => {
                    let creg = required_creg(&op)?;
                    let expr = required_expr(&op)?;

                    ensure_register(&circuit, creg)?;
                    circuit.assign(creg.into(), expr)
                }
                OperationKind::Reset => {
                    let target = required_qubit(&op)?;

                    circuit.reset(target)
                }
                OperationKind::Jump => {
                    let target_step = required_target_step(&op)?;

                    circuit.jump(get_step_label(target_step))
                }
                // TODO Custom gate
                _ => {
                    return Err(JsonParseError::UnsupportedOperation {
                        kind: op.kind,
                        step,
                    });
                }
            }
        }

        if circuit.has_unresolved_labels() {
            Err(JsonParseError::UnresolvedLabel)
        } else {
            Ok(circuit)
        }
    }
}

fn apply_unitary(
    circuit: Circuit,
    op: &InstructionDefinition,
    gate: fn(Circuit, usize) -> Circuit,
    cgate: fn(Circuit, &[usize], usize) -> Circuit,
) -> Result<Circuit, JsonParseError> {
    let target = required_qubit(&op)?;

    Ok(if let Some(controls) = &op.controls {
        cgate(circuit, controls, target)
    } else {
        gate(circuit, target)
    })
}

fn apply_param_unitary(
    circuit: Circuit,
    op: &InstructionDefinition,
    gate: fn(Circuit, f64, usize) -> Circuit,
    cgate: fn(Circuit, f64, &[usize], usize) -> Circuit,
) -> Result<Circuit, JsonParseError> {
    let target = required_qubit(&op)?;
    let param = required_params(&op, 1)?[0];

    Ok(if let Some(controls) = &op.controls {
        cgate(circuit, param, controls, target)
    } else {
        gate(circuit, param, target)
    })
}

fn required_qubit(op: &InstructionDefinition) -> Result<usize, JsonParseError> {
    op.qubit.ok_or(JsonParseError::MissingField {
        kind: op.kind,
        field: "qubit",
        step: op.step,
    })
}

/// Qubits field is used for swap gates, and are always length 2
fn required_qubits(op: &InstructionDefinition) -> Result<Vec<usize>, JsonParseError> {
    op.qubits
        .as_ref()
        .filter(|params| params.len() == 2)
        .cloned()
        .ok_or(JsonParseError::MissingField {
            kind: op.kind,
            field: "qubits",
            step: op.step,
        })
}

fn required_params(op: &InstructionDefinition, num: usize) -> Result<Vec<f64>, JsonParseError> {
    op.params
        .as_ref()
        .filter(|params| params.len() == num)
        .cloned()
        .ok_or(JsonParseError::MissingField {
            kind: op.kind,
            field: "params",
            step: op.step,
        })
}

fn required_creg(op: &InstructionDefinition) -> Result<&str, JsonParseError> {
    op.creg.as_deref().ok_or(JsonParseError::MissingField {
        kind: op.kind,
        field: "creg",
        step: op.step,
    })
}

fn required_creg_bit(op: &InstructionDefinition) -> Result<usize, JsonParseError> {
    op.creg_bit.ok_or(JsonParseError::MissingField {
        kind: op.kind,
        field: "creg_bit",
        step: op.step,
    })
}

fn required_target_step(op: &InstructionDefinition) -> Result<usize, JsonParseError> {
    op.target_step.ok_or(JsonParseError::MissingField {
        kind: op.kind,
        field: "target_step",
        step: op.step,
    })
}

fn required_expr(op: &InstructionDefinition) -> Result<Expr, JsonParseError> {
    op.expr
        .as_ref()
        .cloned()
        .ok_or(JsonParseError::MissingField {
            kind: op.kind,
            field: "expr",
            step: op.step,
        })
}

fn get_step_label(step: usize) -> String {
    format!("_step{step}")
}

fn ensure_register(circuit: &Circuit, reg: &str) -> Result<(), JsonParseError> {
    if circuit.registers().contains(reg) {
        Ok(())
    } else {
        Err(JsonParseError::UnknownRegister {
            name: reg.to_owned(),
        })
    }
}
