export async function api(path, body) {
  const response = await fetch(
    `${import.meta.env.VITE_API_BASE || ""}/api/${path}`,
    {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        token: localStorage.getItem("token") || "",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    }
  );
  if (response.status === 401) {
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("auth-expired"));
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("接口返回异常，请确认后端地址和服务状态");
  }
  if (!response.ok || result.code !== 200)
    throw new Error(result.msg || "请求失败");
  return result;
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
