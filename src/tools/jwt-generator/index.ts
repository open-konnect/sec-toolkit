import React from 'react';
import { jwtGeneratorMetadata } from './metadata';
import { ToolDefinition } from '../../types';

const JwtGeneratorTool = React.lazy(() =>
  import('./components/JwtGeneratorTool').then((module) => ({ default: module.JwtGeneratorTool }))
);

export const jwtGeneratorToolDefinition: ToolDefinition = {
  ...jwtGeneratorMetadata,
  component: JwtGeneratorTool
};

export default JwtGeneratorTool;
