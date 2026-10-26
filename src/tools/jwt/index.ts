import React from 'react';
import { jwtMetadata } from './metadata';
import { ToolDefinition } from '../../types';

const JwtTool = React.lazy(() =>
  import('./components/JwtTool').then((module) => ({ default: module.JwtTool }))
);

export const jwtToolDefinition: ToolDefinition = {
  ...jwtMetadata,
  component: JwtTool
};

export default JwtTool;
