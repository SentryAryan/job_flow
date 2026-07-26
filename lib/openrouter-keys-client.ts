export type MaskedOpenRouterKey = {
  id: string;
  last4: string;
  createdAt: string;
};

export type OpenRouterKeysData = {
  keys: MaskedOpenRouterKey[];
  hasKeys: boolean;
};

export type OpenRouterKeysResult =
  | { success: true; data: OpenRouterKeysData }
  | { success: false; error: string };

async function parseKeysResponse(
  response: Response,
): Promise<OpenRouterKeysResult> {
  const payload = (await response.json()) as {
    success?: boolean;
    data?: OpenRouterKeysData;
    error?: string | null;
  };

  if (!response.ok || !payload.success || !payload.data) {
    return {
      success: false,
      error:
        payload.error ?? "Could not update OpenRouter keys. Please try again.",
    };
  }

  return { success: true, data: payload.data };
}

export async function fetchOpenRouterKeys(
  accessToken: string,
): Promise<OpenRouterKeysResult> {
  try {
    const response = await fetch("/api/profile/openrouter-keys", {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    return await parseKeysResponse(response);
  } catch {
    return {
      success: false,
      error: "Could not load OpenRouter keys. Please try again.",
    };
  }
}

export async function addOpenRouterKey(
  accessToken: string,
  key: string,
): Promise<OpenRouterKeysResult> {
  try {
    const response = await fetch("/api/profile/openrouter-keys", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key }),
    });
    return await parseKeysResponse(response);
  } catch {
    return {
      success: false,
      error: "Could not save OpenRouter key. Please try again.",
    };
  }
}

export async function removeOpenRouterKey(
  accessToken: string,
  id: string,
): Promise<OpenRouterKeysResult> {
  try {
    const response = await fetch("/api/profile/openrouter-keys", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });
    return await parseKeysResponse(response);
  } catch {
    return {
      success: false,
      error: "Could not remove OpenRouter key. Please try again.",
    };
  }
}
