interface RequestParams {
  path: string;
  method?: string;
  body?: unknown;
  token?: string | null;
}

export async function request<T = any>({
  path,
  method = "GET",
  body,
  token,
}: RequestParams): Promise<T> {
  const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
  const url = `${base}${path}`;
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = (data && (data.error || data.message)) || res.statusText;
    throw new Error(message);
  }

  return data as T;
}
