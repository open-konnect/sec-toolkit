import React from 'react';
import { jsonToTypescriptMetadata } from './metadata';
import { ToolDefinition } from '../../types';

const JsonToTypescriptTool = React.lazy(() =>
  import('./components/JsonToTypescriptTool').then((module) => ({ default: module.JsonToTypescriptTool }))
);

export const jsonToTypescriptToolDefinition: ToolDefinition = {
  ...jsonToTypescriptMetadata,
  component: JsonToTypescriptTool
};

export default JsonToTypescriptTool;
