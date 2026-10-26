import { hashGeneratorMetadata } from './metadata';
import { HashGeneratorTool } from './components/HashGeneratorTool';
import { ToolDefinition } from '../../types';

export const hashGeneratorToolDefinition: ToolDefinition = {
  ...hashGeneratorMetadata,
  component: HashGeneratorTool
};

export default HashGeneratorTool;
