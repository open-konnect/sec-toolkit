import React from 'react';
import { hashGeneratorMetadata } from './metadata';
import { ToolDefinition } from '../../types';

const HashGeneratorTool = React.lazy(() =>
  import('./components/HashGeneratorTool').then((module) => ({ default: module.HashGeneratorTool }))
);

export const hashGeneratorToolDefinition: ToolDefinition = {
  ...hashGeneratorMetadata,
  component: HashGeneratorTool
};

export default HashGeneratorTool;
