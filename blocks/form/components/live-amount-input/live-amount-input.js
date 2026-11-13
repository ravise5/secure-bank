import { subscribe } from '../../rules/index.js';
import { updateOrCreateInvalidMsg } from '../../util.js';

const SMALL = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const MAX_AMOUNT = 999999999.99;
const INVALID_AMOUNT = 'Enter an amount from 0 to 99,99,99,999.99 with up to two decimal places.';
const formatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

function integerInWords(number) {
  if (number < 20) return SMALL[number];
  if (number < 100) {
    return `${TENS[Math.floor(number / 10)]}${number % 10 ? ` ${SMALL[number % 10]}` : ''}`;
  }
  const [scale, label] = [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand'],
    [100, 'Hundred']].find(([value]) => number >= value);
  const remainder = number % scale;
  return `${integerInWords(Math.floor(number / scale))} ${label}${remainder ? ` ${integerInWords(remainder)}` : ''}`;
}

function parseAmount(value) {
  const text = String(value ?? '').trim();
  if (!text) return { value: null, words: '', error: '' };
  // Accept ungrouped, Western-grouped, and Indian-grouped amounts, but never misplaced commas.
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,2}(?:,\d{2})*,\d{3})(?:\.\d{0,2})?$/.test(text)) {
    return { error: INVALID_AMOUNT, words: '' };
  }
  const number = Number(text.replaceAll(',', ''));
  if (!Number.isFinite(number) || number > MAX_AMOUNT) {
    return { error: INVALID_AMOUNT, words: '' };
  }
  const cents = Math.round(number * 100);
  const rupees = Math.floor(cents / 100);
  const paise = cents % 100;
  return {
    value: number,
    words: `Rupees ${integerInWords(rupees)}${paise ? ` and ${integerInWords(paise)} Paise` : ''} Only`,
    error: '',
  };
}

function displayAmount(value) {
  const result = parseAmount(value);
  if (result.error) return String(value ?? '');
  return result.value === null ? '' : formatter.format(result.value);
}

export default function decorate(fieldDiv, fieldJson, container, formId) {
  const input = fieldDiv.querySelector('input');
  const properties = fieldJson.properties || {};
  let model;
  fieldDiv.classList.add('live-amount-input');
  input.type = 'text';
  input.inputMode = 'decimal';
  input.classList.add('live-amount-input-control');

  const heading = document.createElement('h2');
  heading.className = 'live-amount-input-title';
  heading.textContent = properties.title ?? 'live-amount-input';
  const subtitle = document.createElement('p');
  subtitle.className = 'live-amount-input-subtitle';
  subtitle.textContent = properties.subtitle ?? 'Amount input with live amount-in-words update';
  fieldDiv.prepend(heading, subtitle);

  const control = document.createElement('div');
  control.className = 'live-amount-input-entry';
  const prefix = document.createElement('span');
  prefix.className = 'live-amount-input-prefix';
  prefix.textContent = '\u20b9';
  prefix.setAttribute('aria-hidden', 'true');
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'live-amount-input-clear';
  clear.setAttribute('aria-label', 'Clear amount');
  clear.textContent = '\u00d7';
  input.before(control);
  control.append(prefix, input, clear);

  const wordsLabel = document.createElement('span');
  wordsLabel.className = 'live-amount-input-words-label';
  wordsLabel.id = `${input.id}-words-label`;
  wordsLabel.textContent = properties.wordsLabel ?? 'Amount (in words)';
  const words = document.createElement('output');
  words.className = 'live-amount-input-words';
  words.id = `${input.id}-words`;
  words.htmlFor = input.id;
  words.setAttribute('aria-labelledby', wordsLabel.id);
  words.setAttribute('aria-live', 'polite');
  words.setAttribute('aria-atomic', 'true');
  input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), words.id].filter(Boolean).join(' '));
  const note = document.createElement('p');
  note.className = 'live-amount-input-readonly';
  note.textContent = properties.readOnlyLabel ?? 'Read-only';
  control.after(wordsLabel, words, note);

  const updateState = () => {
    const state = model || fieldJson;
    input.readOnly = state.readOnly === true;
    input.disabled = state.enabled === false;
    clear.disabled = input.readOnly || input.disabled;
    clear.hidden = input.value === '';
  };

  const updateWords = () => {
    const result = parseAmount(input.value);
    const minimum = model?.minimum ?? fieldJson.minimum ?? 0;
    const maximum = model?.maximum ?? fieldJson.maximum ?? MAX_AMOUNT;
    let { error } = result;
    if (!error && result.value !== null && result.value < minimum) {
      error = fieldJson.constraintMessages?.minimum ?? `Enter an amount of at least ${minimum}.`;
    } else if (!error && result.value !== null && result.value > maximum) {
      error = fieldJson.constraintMessages?.maximum ?? `Enter an amount no greater than ${maximum}.`;
    }
    words.textContent = error ? '' : result.words;
    input.setCustomValidity(error);
    input.setAttribute('aria-invalid', String(Boolean(error)));
    updateOrCreateInvalidMsg(input, error);
    updateState();
    return { ...result, error };
  };

  const commit = () => {
    const result = updateWords();
    if (!result.error && model) {
      if (model.value !== result.value) model.value = result.value;
      input.value = result.value === null ? '' : formatter.format(result.value);
    }
  };

  input.addEventListener('input', updateWords);
  input.addEventListener('change', (event) => {
    // The form's generic change listener cannot parse the grouped display value.
    event.stopPropagation();
    commit();
  });
  input.addEventListener('blur', commit);
  clear.addEventListener('click', () => {
    if (clear.disabled) return;
    input.value = '';
    commit();
    input.focus();
  });

  subscribe(fieldDiv, formId, (_fieldDiv, fieldModel, eventType, payload) => {
    if (eventType === 'register') {
      model = fieldModel;
      input.value = displayAmount(model.value);
      updateWords();
    } else if (eventType === 'change') {
      payload?.changes?.forEach(({ propertyName, currentValue }) => {
        if (propertyName === 'value') {
          input.value = displayAmount(currentValue);
          updateWords();
        } else if (['enabled', 'readOnly'].includes(propertyName)) {
          updateState();
        } else if (['minimum', 'maximum'].includes(propertyName)) {
          updateWords();
        }
      });
    }
  }, { listenChanges: true });
  updateWords();
  return fieldDiv;
}
