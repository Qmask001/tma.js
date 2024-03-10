import type { Component } from 'solid-js';
import { mergeProps } from 'solid-js';

import type { ExtractPropsClasses, WithOptionalClasses } from './types.js';

export interface StyledOptions {
  /**
   * Returned component name.
   * @default `Styled{Component.name}`
   */
  name?: string;
}

/**
 * Returns Higher Order Component which transfers passed properties adding specified classes.
 * @param Component - wrapped component.
 * @param classes - classes map.
 * @param options - additional options.
 *
 * @example
 * const MyCheckbox = styled(Checkbox, {
 *   root: 'my-checkbox',
 *   input: 'my-checkbox__input',
 *   ...
 * });
 */
export function styled<Props extends WithOptionalClasses<any, any>>(
  Component: Component<Props>,
  classes: ExtractPropsClasses<Props>,
  options: StyledOptions = {},
): Component<Props> {
  const Wrapped: Component<Props> = (props) => {
    const mergedProps = mergeProps({ classes: {} }, props);

    // Merge element keys from the passed properties and classes from HOC.
    // Concat classes keys passed from the parent component with the classes keys passed
    // from styled.
    const keys = [
      ...new Set([
        ...Object.keys(mergedProps.classes),
        ...Object.keys(classes),
      ]),
    ];

    // Iterate over each found key, extract its value from both class maps and merge into a single
    // array.
    const mergedClasses = keys.reduce<ExtractPropsClasses<Props>>((acc, key) => {
      (acc as any)[key] = [
        (mergedProps.classes as any)[key],
        (classes as any)[key as any],
      ];
      return acc;
    }, {} as ExtractPropsClasses<Props>);

    return <Component {...props} classes={mergedClasses}/>;
  };

  Object.defineProperty(Wrapped, 'name', {
    value: options.name || `Styled${Component.name}`,
  });

  return Wrapped;
}
