import React from 'react';
import { cronGeneratorMetadata } from './metadata';
import { ToolDefinition } from '../../types';

const CronGeneratorTool = React.lazy(() =>
  import('./components/CronGeneratorTool').then((module) => ({ default: module.CronGeneratorTool }))
);

export const cronGeneratorToolDefinition: ToolDefinition = {
  ...cronGeneratorMetadata,
  component: CronGeneratorTool
};

export default CronGeneratorTool;
