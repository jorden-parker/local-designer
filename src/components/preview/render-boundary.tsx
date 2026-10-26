"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; onError: (message: string) => void };

export class RenderBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error.message);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
