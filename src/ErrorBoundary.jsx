import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error) {
    // 不把堆栈、接口地址或用户标注内容显示给用户，也不自动上传诊断数据。
    if (import.meta.env.DEV) console.error("标注工作区渲染失败", error);
  }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null;
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <section className={`recovery-panel ${this.props.fullPage ? "recovery-page" : "panel"}`} role="alert">
      <span className="eyebrow">OPEN MARKER / RECOVERY</span>
      <h2>{this.props.fullPage ? "工作区暂时无法显示" : "此区域暂时无法显示"}</h2>
      <p>已保存的数据不受影响。可以重试或返回项目总览；未保存内容请在恢复后检查会话草稿。</p>
      <div className="toolbar">
        <button className="primary" onClick={() => {
          if (this.props.fullPage) window.location.reload();
          else this.setState({ failed: false });
        }}>{this.props.fullPage ? "重新打开工作区" : "重试此区域"}</button>
        <a href="#overview" onClick={this.props.fullPage ? event => {
          event.preventDefault();
          window.location.hash = "overview";
          window.location.reload();
        } : undefined}>返回项目总览 →</a>
      </div>
    </section>;
  }
}
