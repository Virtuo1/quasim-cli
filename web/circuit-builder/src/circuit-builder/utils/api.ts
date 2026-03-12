import type {
  BasisResponse,
  BuildResponse,
  RegistersResponse,
  SerializedCircuit,
  StateResponse,
  StateVectorResponse,
} from "../types";

export async function buildDebugSession(serializedCircuit: SerializedCircuit): Promise<BuildResponse> {
  return requestJSON<BuildResponse>("/api/debug/build", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(serializedCircuit),
  });
}

export async function fetchDebugSessionState(sessionId: string): Promise<StateResponse> {
  return requestJSON<StateResponse>(`/api/debug/${sessionId}/state`);
}

export async function fetchDebugSessionRegisters(sessionId: string): Promise<RegistersResponse> {
  return requestJSON<RegistersResponse>(`/api/debug/${sessionId}/registers`);
}

export async function fetchDebugSessionStateVector(
  sessionId: string,
  options?: { topN?: number; nonzero?: boolean },
): Promise<StateVectorResponse> {
  const search = new URLSearchParams();
  if (typeof options?.topN === "number") {
    search.set("top_n", String(options.topN));
  }
  if (typeof options?.nonzero === "boolean") {
    search.set("nonzero", String(options.nonzero));
  }

  const query = search.size > 0 ? `?${search.toString()}` : "";
  return requestJSON<StateVectorResponse>(`/api/debug/${sessionId}/statevector${query}`);
}

export async function fetchDebugSessionBasisAmplitude(sessionId: string, basis: number): Promise<BasisResponse> {
  return requestJSON<BasisResponse>(`/api/debug/${sessionId}/statevector/${basis}`);
}

export async function nextDebugSession(sessionId: string): Promise<StateResponse> {
  return requestJSON<StateResponse>(`/api/debug/${sessionId}/next`);
}

export async function continueDebugSession(sessionId: string): Promise<StateResponse> {
  return requestJSON<StateResponse>(`/api/debug/${sessionId}/continue`);
}

async function requestJSON<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}
