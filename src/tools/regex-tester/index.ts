import React from 'react';
import { regexTesterMetadata } from './metadata';
import { ToolDefinition } from '../../types';

const RegexTesterTool = React.lazy(() =>
  import('./components/RegexTesterTool').then((module) => ({ default: module.RegexTesterTool }))
);

export const regexTesterToolDefinition: ToolDefinition = {
  ...regexTesterMetadata,
  component: RegexTesterTool
};

export default RegexTesterTool;
