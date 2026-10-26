import { jwtMetadata } from './metadata';
import { JwtTool } from './components/JwtTool';
import { ToolDefinition } from '../../types';

export const jwtToolDefinition: ToolDefinition = {
  ...jwtMetadata,
  component: JwtTool
};

export default JwtTool;
