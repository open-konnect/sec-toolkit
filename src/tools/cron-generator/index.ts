import { cronGeneratorMetadata } from './metadata';
import { CronGeneratorTool } from './components/CronGeneratorTool';
import { ToolDefinition } from '../../types';

export const cronGeneratorToolDefinition: ToolDefinition = {
  ...cronGeneratorMetadata,
  component: CronGeneratorTool
};

export default CronGeneratorTool;
