import React from 'react';
import { jsonFormatterMetadata } from './metadata';
import { ToolDefinition } from '../../types';

const JsonFormatterTool = React.lazy(() =>
  import('./components/JsonFormatterTool').then((module) => ({ default: module.JsonFormatterTool }))
);

export const jsonFormatterToolDefinition: ToolDefinition = {
  ...jsonFormatterMetadata,
  component: JsonFormatterTool
};

export default JsonFormatterTool;
