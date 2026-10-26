import { securityHeadersMetadata } from './metadata';
import { SecurityHeadersTool } from './components/SecurityHeadersTool';
import { ToolDefinition } from '../../types';

export const securityHeadersToolDefinition: ToolDefinition = {
  ...securityHeadersMetadata,
  component: SecurityHeadersTool
};

export default SecurityHeadersTool;
