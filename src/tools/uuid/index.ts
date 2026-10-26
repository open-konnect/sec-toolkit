import React from 'react';
import { uuidMetadata } from './metadata';
import { ToolDefinition } from '../../types';

const UuidTool = React.lazy(() =>
  import('./components/UuidTool').then((module) => ({ default: module.UuidTool }))
);

export const uuidToolDefinition: ToolDefinition = {
  ...uuidMetadata,
  component: UuidTool
};

export default UuidTool;
