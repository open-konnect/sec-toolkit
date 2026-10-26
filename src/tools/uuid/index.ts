import { uuidMetadata } from './metadata';
import { UuidTool } from './components/UuidTool';
import { ToolDefinition } from '../../types';

export const uuidToolDefinition: ToolDefinition = {
  ...uuidMetadata,
  component: UuidTool
};

export default UuidTool;
