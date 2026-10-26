import { cspGeneratorMetadata } from './metadata';
import { CspGeneratorTool } from './components/CspGeneratorTool';
import { ToolDefinition } from '../../types';

export const cspGeneratorToolDefinition: ToolDefinition = {
  ...cspGeneratorMetadata,
  component: CspGeneratorTool
};

export default CspGeneratorTool;
