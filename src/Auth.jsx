import { useEffect, useState } from "react";
import { api } from "./api";
const demoEnabled = import.meta.env.DEV && import.meta.env.VITE_DEMO_LOGIN === "true";
export default function Auth({ onLogin }) {
  const [demo, setDemo] = useState(null), [demoAccount, setDemoAccount] = useState("");
  useEffect(() => {
    // 生产构建不包含体验入口；只在显式启用的本机开发环境探测演示服务。
    if (!demoEnabled || !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) return;
    let active = true;
    api("annotation/demo-info").then(r => { if (active && r.data.isolated) { setDemo(r.data); setDemoAccount(r.data.accounts[0].mobile); } }).catch(() => {});
    return () => { active = false; };
  }, []);
  const [register, setRegister] = useState(false),
    [captcha, setCaptcha] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function enterDemo() {
    setBusy(true); setError("");
    try {
      const result = await api("user/login", { mobile: demoAccount, password: demo.password });
      localStorage.setItem("token", result.token);
      await onLogin();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fields = Object.fromEntries(new FormData(event.currentTarget));
      const result = await api(
        `user/${register ? "register" : "login"}`,
        fields
      );
      if (register) {
        setRegister(false);
        setCaptcha("");
        setError("注册成功，请登录");
      } else {
        localStorage.setItem("token", result.token);
        await onLogin();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function code(event) {
    setBusy(true);
    setError("");
    try {
      const result = await api("user/getCode", {
        mobile: event.currentTarget.form.elements.mobile.value,
      });
      setCaptcha(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.data)}`
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <span className="brand">✳ OPEN MARKER</span>
        <h1>
          好的模型，
          <br />
          始于好的数据。
        </h1>
        <p>
          连接数据、标注与审核。
          <br />
          让团队的每一次判断，都成为可靠的训练资产。
        </p>
        <small>DATA ANNOTATION WORKSPACE</small>
      </section>
      <form className="auth-form" onSubmit={submit}>
        <span className="eyebrow">欢迎来到标注工作区</span>
        <h2>{register ? "创建账号" : "登录 Open Marker"}</h2>
        <p>{demoEnabled && demo ? "当前为本地隔离环境，请使用体验账号或在此注册。" : "使用惊觉社区账号即可登录"}</p>
        {demoEnabled && demo && !register && <section className="demo-entry" aria-label="本地体验账号">
          <span className="eyebrow">LOCAL SANDBOX · 本地演示</span>
          <p>已准备文本、图片、实体识别示例。数据独立保存，不影响业务环境。</p>
          <label>体验角色<select value={demoAccount} disabled={busy} onChange={e => setDemoAccount(e.target.value)}>{demo.accounts.map(a => <option key={a.mobile} value={a.mobile}>{a.name} · {a.mobile}</option>)}</select></label>
          <p className="demo-credentials">密码：<code>{demo.password}</code></p>
          <button type="button" className="primary" disabled={busy} onClick={enterDemo}>{busy ? "正在进入…" : "一键进入体验 →"}</button>
          <small>公开测试账号仅用于本机，请勿上传敏感数据。</small>
        </section>}
        {register && (
          <label>
            昵称
            <input
              name="nickname"
              required
              maxLength={40}
              autoComplete="nickname"
            />
          </label>
        )}
        <label>
          手机号
          <input
            name="mobile"
            type="tel"
            pattern="1[0-9]{10}"
            required
            autoComplete="username"
          />
        </label>
        <label>
          密码
          <input
            name="password"
            type="password"
            minLength={6}
            required
            autoComplete={register ? "new-password" : "current-password"}
          />
        </label>
        {register && (
          <>
            <button type="button" disabled={busy} onClick={code}>
              获取图形验证码
            </button>
            {captcha && (
              <img className="captcha" src={captcha} alt="图形验证码" />
            )}
            <label>
              验证码
              <input name="code" required />
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "处理中…" : register ? "注册" : "登录工作区 →"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register ? "已有账号，返回登录" : "还没有账号？注册"}
        </button>
      </form>
    </main>
  );
}
