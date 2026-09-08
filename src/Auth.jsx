import { useState } from "react";
import { api } from "./api";
export default function Auth({ onLogin }) {
  const [register, setRegister] = useState(false),
    [captcha, setCaptcha] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
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
        <p>使用惊觉社区账号即可登录</p>
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
