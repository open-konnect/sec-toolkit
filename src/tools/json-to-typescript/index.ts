import { jsonToTypescriptMetadata } from './metadata';
import { JsonToTypescriptTool } from './components/JsonToTypescriptTool';
import { ToolDefinition } from '../../types';

export const jsonToTypescriptToolDefinition: ToolDefinition = {
  ...jsonToTypescriptMetadata,
  component: JsonToTypescriptTool
};

export default JsonToTypescriptTool;
