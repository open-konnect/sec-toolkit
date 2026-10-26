import React from 'react';
import { base64Metadata } from './metadata';
import { ToolDefinition } from '../../types';

const Base64Tool = React.lazy(() =>
  import('./components/Base64Tool').then((module) => ({ default: module.Base64Tool }))
);

export const base64ToolDefinition: ToolDefinition = {
  ...base64Metadata,
  component: Base64Tool
};

export default Base64Tool;
