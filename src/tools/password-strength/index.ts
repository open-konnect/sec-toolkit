import { passwordStrengthMetadata } from './metadata';
import { PasswordStrengthTool } from './components/PasswordStrengthTool';
import { ToolDefinition } from '../../types';

export const passwordStrengthToolDefinition: ToolDefinition = {
  ...passwordStrengthMetadata,
  component: PasswordStrengthTool
};

export default PasswordStrengthTool;
