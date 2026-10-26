import React from 'react';
import { urlEncoderMetadata } from './metadata';
import { ToolDefinition } from '../../types';

const UrlEncoderTool = React.lazy(() =>
  import('./components/UrlEncoderTool').then((module) => ({ default: module.UrlEncoderTool }))
);

export const urlEncoderToolDefinition: ToolDefinition = {
  ...urlEncoderMetadata,
  component: UrlEncoderTool
};

export default UrlEncoderTool;
