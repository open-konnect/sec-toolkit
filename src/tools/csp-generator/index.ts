import React from 'react';
import { cspGeneratorMetadata } from './metadata';
import { ToolDefinition } from '../../types';

const CspGeneratorTool = React.lazy(() =>
  import('./components/CspGeneratorTool').then((module) => ({ default: module.CspGeneratorTool }))
);

export const cspGeneratorToolDefinition: ToolDefinition = {
  ...cspGeneratorMetadata,
  component: CspGeneratorTool
};

export default CspGeneratorTool;
