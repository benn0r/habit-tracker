const API = "https://api.todoist.com/api/v1";

async function todoist<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Todoist ${response.status}: ${await response.text()}`);
  return response.json();
}

export async function paged<T>(path: string, token: string, collectionKey = "results") {
  const output: T[] = [];
  let cursor: string | null = null;
  do {
    const separator = path.includes("?") ? "&" : "?";
    const data: Record<string, unknown> & { next_cursor?: string } = await todoist<Record<string, unknown> & { next_cursor?: string }>(
      `${path}${cursor ? `${separator}cursor=${encodeURIComponent(cursor)}` : ""}`, token
    );
    const items = data[collectionKey];
    if (!Array.isArray(items)) throw new Error(`Todoist response did not contain "${collectionKey}"`);
    output.push(...(items as T[]));
    cursor = data.next_cursor || null;
  } while (cursor);
  return output;
}

export { todoist };
