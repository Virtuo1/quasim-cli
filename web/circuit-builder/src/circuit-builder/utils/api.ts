import type { SerializedCircuit } from "../types";

export interface RunResponse {
  value: number;
}

export async function runCircuit(serializedCircuit: SerializedCircuit): Promise<RunResponse> {
  const response = await fetch("/api/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(serializedCircuit),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as RunResponse;
}
