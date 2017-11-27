import * as React from "react";
import * as PropTypes from "prop-types";
import { Color } from "./const";

type Tree<T> = {
  val: T;
  left: Tree<T> | null;
  right: Tree<T> | null;
};

interface Props {
  foo: string;
  items: Tree<number>;
  children: React.ReactNode;
}

export class FooComponent extends React.Component<Props> {
  context: {
    wat: string;
    neat: {
      x: boolean;
      y: number;
      cool: (n: number) => void;
    };
  };

  render() {
    return this.props.foo;
  }
}

interface DialogProps {
  onCancel: () => void;
  onConfirm: () => void;
  cancelLabel?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  confirmColor?: Color;
  irreversible?: boolean;
}

export class ConfirmationDialog extends React.Component<DialogProps> {
  render() {
    return null;
  }

  private handleConfirm = () => {
    this.setState({ confirming: true });
    this.props.onConfirm();
  };
}
