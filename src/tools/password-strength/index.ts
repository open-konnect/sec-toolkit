import React from 'react';
import { passwordStrengthMetadata } from './metadata';
import { ToolDefinition } from '../../types';

const PasswordStrengthTool = React.lazy(() =>
  import('./components/PasswordStrengthTool').then((module) => ({ default: module.PasswordStrengthTool }))
);

export const passwordStrengthToolDefinition: ToolDefinition = {
  ...passwordStrengthMetadata,
  component: PasswordStrengthTool
};

export default PasswordStrengthTool;
