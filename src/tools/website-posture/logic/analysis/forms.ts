/**
 * Structural form classification.
 *
 * Everything here works from markup *structure* — field types, field and form
 * identifiers, autocomplete tokens, and the action path. Field **values** are
 * never captured by the scanner and never reach this module, so no classifier
 * can observe what a user typed or what a page pre-filled.
 *
 * No form is ever submitted, and no credential flow is ever exercised.
 */

import { PageForm, PageFormKind } from '../../types';

export interface FormClassificationInput {
  /** Lowercase input `type` values present on the form. */
  inputTypes: readonly string[];
  /**
   * Lowercase `name`, `id`, and `autocomplete` tokens from the form's fields.
   *
   * These are markup identifiers, not user input.
   */
  fieldTokens: readonly string[];
  /** Lowercase action path plus the form's own `id` and `name`. */
  contextTokens: readonly string[];
}

const PAYMENT_TOKENS =
  /(?:cardnumber|card[_-]?number|cc[_-]?(?:number|num|exp|csc)|creditcard|credit[_-]?card|cvc|cvv|csc|securitycode|security[_-]?code|expir|billing[_-]?(?:address|zip|postal)|iban|routing[_-]?number|accountnumber)/;

const RESET_TOKENS = /(?:reset|forgot|recover|lost[_-]?password|new[_-]?password)/;

const REGISTRATION_TOKENS =
  /(?:register|registration|signup|sign[_-]?up|create[_-]?account|newaccount|confirm[_-]?password|password[_-]?confirm|repeat[_-]?password|retype)/;

const LOGIN_TOKENS = /(?:login|log[_-]?in|signin|sign[_-]?on|sign[_-]?in|authenticate|session)/;

const NEWSLETTER_TOKENS = /(?:newsletter|subscribe|subscription|mailing[_-]?list)/;

const SEARCH_TOKENS = /(?:search|query|\bq\b|lookup|find)/;

function matches(pattern: RegExp, groups: ReadonlyArray<readonly string[]>): boolean {
  return groups.some((group) => group.some((token) => pattern.test(token)));
}

/**
 * Classifies a form into one of a fixed set of shapes.
 *
 * The order of the rules is the important part: a payment form that also has a
 * password field is still a payment form, and a reset form that contains a new
 * password field is not a registration form.
 */
export function classifyForm(input: FormClassificationInput): PageFormKind {
  const { inputTypes, fieldTokens, contextTokens } = input;
  const all = [fieldTokens, contextTokens];

  const hasPassword = inputTypes.includes('password');
  const hasEmailOrText =
    inputTypes.includes('email') || inputTypes.includes('text') || inputTypes.includes('tel');

  if (matches(PAYMENT_TOKENS, all)) return 'payment';
  if (matches(RESET_TOKENS, all) && (hasPassword || hasEmailOrText)) return 'password-reset';
  if (hasPassword && matches(REGISTRATION_TOKENS, all)) return 'registration';
  if (hasPassword) return 'login';
  if (matches(LOGIN_TOKENS, all) && hasEmailOrText) return 'login';
  if (matches(NEWSLETTER_TOKENS, all)) return 'newsletter';
  if (inputTypes.includes('search') || matches(SEARCH_TOKENS, all)) return 'search';

  return 'other';
}

/** True when a field token set asks for payment-card-like data. */
export function looksLikePaymentField(tokens: readonly string[]): boolean {
  return tokens.some((token) => PAYMENT_TOKENS.test(token));
}

export const FORM_KIND_LABELS: Record<PageFormKind, string> = {
  login: 'sign-in form',
  registration: 'registration form',
  'password-reset': 'password reset form',
  payment: 'payment or billing form',
  newsletter: 'newsletter signup',
  search: 'search form',
  other: 'form'
};

/**
 * Forms whose submission carries credentials, identity, or payment data.
 *
 * Used to decide which forms deserve a transport verdict. A search box
 * submitting over plaintext HTTP on an HTTP site is a different matter from a
 * sign-in form doing it.
 */
export function isSensitiveForm(form: PageForm): boolean {
  if (form.hasPasswordField || form.hasPaymentField) return true;
  return form.kind === 'login' || form.kind === 'registration' || form.kind === 'password-reset' || form.kind === 'payment';
}

/** Describes a form for report text without naming any field. */
export function describeForm(form: PageForm): string {
  const label = FORM_KIND_LABELS[form.kind];
  const method = form.method.toUpperCase();
  return `${label} submitted with ${method}`;
}
