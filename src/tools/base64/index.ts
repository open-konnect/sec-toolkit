import { base64Metadata } from './metadata';
import { Base64Tool } from './components/Base64Tool';
import { ToolDefinition } from '../../types';

export const base64ToolDefinition: ToolDefinition = {
  ...base64Metadata,
  component: Base64Tool
};

export default Base64Tool;
