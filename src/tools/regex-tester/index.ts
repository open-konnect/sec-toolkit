import { regexTesterMetadata } from './metadata';
import { RegexTesterTool } from './components/RegexTesterTool';
import { ToolDefinition } from '../../types';

export const regexTesterToolDefinition: ToolDefinition = {
  ...regexTesterMetadata,
  component: RegexTesterTool
};

export default RegexTesterTool;
