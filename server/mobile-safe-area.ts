import React from 'react';

type FrameProps = { children?: React.ReactNode; style?: React.CSSProperties };

export function wrapDeviceComponent(
  name: string,
  component: React.ComponentType<any>,
  mode: 'safe-area' | 'device',
): React.ComponentType<any> {
  if (mode === 'device' || (name !== 'IOSDevice' && name !== 'AndroidDevice')) return component;

  return function SafeAreaDevice(props: any) {
    // shortcut: these two packaged starters are pure functions; review this adapter when their snapshot changes.
    const frame = (component as React.FunctionComponent<any>)(props);
    if (!React.isValidElement<FrameProps>(frame)) throw new Error(`Invalid ${name} starter frame`);
    const children = React.Children.toArray(frame.props.children);
    const style: React.CSSProperties = {
      ...frame.props.style,
      border: 0,
      borderRadius: 0,
      boxShadow: 'none',
      boxSizing: 'border-box',
    };

    if (name === 'IOSDevice') {
      const content = children[2];
      if (!React.isValidElement<FrameProps>(content)) throw new Error('Invalid IOSDevice content');
      return React.cloneElement(frame, { style }, React.cloneElement(content, {
        style: {
          ...content.props.style,
          boxSizing: 'border-box',
          // IOSNavBar already reserves 62px above its app controls.
          paddingTop: props.title === undefined ? 54 : 0,
          paddingBottom: 34,
        },
      }));
    }

    return React.cloneElement(frame, {
      style: { ...style, paddingTop: 32, paddingBottom: 24 },
    }, ...children.slice(1, -1));
  };
}
