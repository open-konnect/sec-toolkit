import { jwtGeneratorMetadata } from './metadata';
import { JwtGeneratorTool } from './components/JwtGeneratorTool';
import { ToolDefinition } from '../../types';

export const jwtGeneratorToolDefinition: ToolDefinition = {
  ...jwtGeneratorMetadata,
  component: JwtGeneratorTool
};

export default JwtGeneratorTool;
