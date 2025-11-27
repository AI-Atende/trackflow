const META_GRAPH_API_BASE = "https://graph.facebook.com/v19.0";

type MetaRequestParams = Record<string, string | number | boolean | undefined>;

export async function metaGet<T = any>(
    path: string,
    accessToken: string,
    params: MetaRequestParams = {}
): Promise<T> {
    const url = new URL(`${META_GRAPH_API_BASE}${path}`);
    url.searchParams.set("access_token", accessToken);

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
            url.searchParams.set(key, String(value));
        }
    });

    const res = await fetch(url.toString(), { method: "GET" });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Meta API error ${res.status}: ${text}`);
    }

    return res.json();
}
