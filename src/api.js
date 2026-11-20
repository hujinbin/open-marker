export async function api(path, body) {
  let response;
  try { response = await fetch(
    `${import.meta.env?.VITE_API_BASE || ""}/api/${path}`,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        token: localStorage.getItem("token") || "",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    }
  ); } catch (error) {
    throw new Error(error.name === "TimeoutError" ? "请求超时，请稍后重试" : "暂时无法连接服务，请检查网络后重试");
  }
  if (response.status === 401) {
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("auth-expired"));
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("服务返回异常，请稍后重试");
  }
  if (!result || typeof result !== "object" || Array.isArray(result))
    throw new Error("服务返回异常，请稍后重试");
  if (!response.ok || result.code !== 200) {
    const message = response.status >= 500 ? "服务暂时不可用，请稍后重试" : typeof result.msg === "string" ? result.msg : "请求失败，请稍后重试";
    throw Object.assign(new Error(message), { status: response.status });
  }
  return result;
}
export async function assetUrl(projectId, assetId) {
  const r = await fetch(`${import.meta.env.VITE_API_BASE || ""}/api/annotation/projects/${projectId}/assets/${assetId}`, { headers: { token: localStorage.getItem("token") || "" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error("图片读取失败，请检查登录状态和资源权限");
  return URL.createObjectURL(await r.blob());
}
export function download(rows, name) {
  const url = URL.createObjectURL(
    new Blob([rows.map((row) => JSON.stringify(row)).join("\n")], {
      type: "application/x-ndjson;charset=utf-8",
    })
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.jsonl`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
