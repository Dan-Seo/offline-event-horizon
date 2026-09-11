import { Component, type ReactNode } from "react";

// The lens reads live perception state; a draw failure must not take the world with it.
export class LensBoundary extends Component<
  { message: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="lab-error" role="alert">
        {this.props.message}
      </p>
    ) : (
      this.props.children
    );
  }
}
