import { jsonFormatterMetadata } from './metadata';
import { JsonFormatterTool } from './components/JsonFormatterTool';
import { ToolDefinition } from '../../types';

export const jsonFormatterToolDefinition: ToolDefinition = {
  ...jsonFormatterMetadata,
  component: JsonFormatterTool
};

export default JsonFormatterTool;
