import React from 'react';
import { securityHeadersMetadata } from './metadata';
import { ToolDefinition } from '../../types';

const SecurityHeadersTool = React.lazy(() =>
  import('./components/SecurityHeadersTool').then((module) => ({ default: module.SecurityHeadersTool }))
);

export const securityHeadersToolDefinition: ToolDefinition = {
  ...securityHeadersMetadata,
  component: SecurityHeadersTool
};

export default SecurityHeadersTool;
