import { urlEncoderMetadata } from './metadata';
import { UrlEncoderTool } from './components/UrlEncoderTool';
import { ToolDefinition } from '../../types';

export const urlEncoderToolDefinition: ToolDefinition = {
  ...urlEncoderMetadata,
  component: UrlEncoderTool
};

export default UrlEncoderTool;
