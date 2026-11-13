/* eslint-env mocha */
import assert from 'assert';
import decorate from '../../blocks/form/components/live-amount-input/live-amount-input.js';
import { loadRuleEngine } from '../../blocks/form/rules/index.js';

describe('Live Amount Input', () => {
  let form;
  let wrapper;
  let input;
  let output;
  let model;
  let sequence = 0;

  const edit = (value) => {
    input.value = value;
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const commit = () => input.dispatchEvent(new window.Event('change', { bubbles: true }));
  const settle = () => new Promise((resolve) => { setTimeout(resolve, 0); });

  async function render(overrides = {}) {
    sequence += 1;
    const formId = `amount-unit-${sequence}`;
    const definition = {
      id: 'amount-unit-field',
      name: 'amount',
      fieldType: 'number-input',
      type: 'number',
      value: 12345.67,
      default: 12345.67,
      ...overrides,
    };
    form = document.createElement('form');
    form.dataset.id = formId;
    wrapper = document.createElement('div');
    wrapper.className = 'field-wrapper';
    wrapper.dataset.id = definition.id;
    input = document.createElement('input');
    input.id = definition.id;
    input.name = definition.name;
    input.value = String(definition.value ?? '');
    wrapper.append(input);
    form.append(wrapper);
    document.body.append(form);
    decorate(wrapper, definition, form, formId);
    await loadRuleEngine({ id: formId, items: [definition] }, form, null, () => {}, null);
    model = window.myForm.getElement(definition.id);
    output = wrapper.querySelector('output');
  }

  afterEach(() => {
    form?.remove();
  });

  it('converts rupees and paise across Indian denomination boundaries without floating-point artifacts', async () => {
    await render();
    const cases = [
      ['0', 'Rupees Zero Only'],
      ['0.29', 'Rupees Zero and Twenty Nine Paise Only'],
      ['19', 'Rupees Nineteen Only'],
      ['20', 'Rupees Twenty Only'],
      ['100', 'Rupees One Hundred Only'],
      ['1000', 'Rupees One Thousand Only'],
      ['1,00,000.01', 'Rupees One Lakh and One Paise Only'],
      ['12,345.67', 'Rupees Twelve Thousand Three Hundred Forty Five and Sixty Seven Paise Only'],
      ['1,23,45,678.9', 'Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight and Ninety Paise Only'],
    ];
    cases.forEach(([value, words]) => {
      edit(value);
      assert.strictEqual(output.textContent, words);
    });
    assert.strictEqual(model.value, 12345.67);
  });

  it('commits grouped amounts numerically once and clears immediately', async () => {
    await render();
    let changes = 0;
    model.subscribe((event) => {
      changes += event.payload.changes.filter((change) => change.propertyName === 'value').length;
    }, 'change');
    edit('1,234,567.89');
    commit();
    input.dispatchEvent(new window.Event('blur'));
    await settle();
    assert.strictEqual(model.value, 1234567.89);
    assert.strictEqual(input.value, '12,34,567.89');
    assert.strictEqual(changes, 1);
    wrapper.querySelector('button').click();
    await settle();
    assert.strictEqual(model.value, null);
    assert.strictEqual(output.textContent, '');
    assert.strictEqual(document.activeElement, input);
    assert.strictEqual(changes, 2);
  });

  it('rejects invalid syntax, precision, and unsupported amounts without replacing the committed value', async () => {
    await render();
    ['-1', '1.234', '1e3', '12,34', 'abc', '1000000000', '9'.repeat(400)].forEach((value) => {
      edit(value);
      commit();
      assert.strictEqual(form.checkValidity(), false);
      assert.strictEqual(output.textContent, '');
      assert.strictEqual(model.value, 12345.67);
      assert.match(wrapper.querySelector('.field-description').textContent, /Enter an amount from 0/);
    });
    edit('42');
    assert.strictEqual(input.checkValidity(), true);
    assert.strictEqual(wrapper.classList.contains('field-invalid'), false);
  });

  it('synchronizes external values, resets, and invalid prefill', async () => {
    await render({ value: null, default: null });
    assert.strictEqual(input.value, '');
    model.value = 42.01;
    await settle();
    assert.strictEqual(input.value, '42.01');
    assert.strictEqual(output.textContent, 'Rupees Forty Two and One Paise Only');
    model.value = 'invalid';
    await settle();
    assert.strictEqual(input.value, 'invalid');
    assert.strictEqual(input.checkValidity(), false);
    model.value = null;
    await settle();
    assert.strictEqual(input.value, '');
    assert.strictEqual(output.textContent, '');
  });

  it('enforces authored and dynamically updated amount limits', async () => {
    await render({ minimum: 10, maximum: 100, value: 42, default: 42 });
    edit('9');
    assert.match(input.validationMessage, /at least 10/);
    edit('101');
    assert.match(input.validationMessage, /no greater than 100/);
    edit('42');
    model.minimum = 50;
    await settle();
    assert.match(input.validationMessage, /at least 50/);
    model.minimum = 0;
    model.maximum = 30;
    await settle();
    assert.match(input.validationMessage, /no greater than 30/);
  });

  it('uses authored validation messages and labels', async () => {
    await render({
      minimum: 10,
      maximum: 100,
      value: 42,
      default: 42,
      constraintMessages: { minimum: 'Too small', maximum: 'Too large' },
      properties: {
        title: 'Transfer', subtitle: 'INR only', wordsLabel: 'In words', readOnlyLabel: 'Calculated',
      },
    });
    assert.strictEqual(wrapper.querySelector('h2').textContent, 'Transfer');
    assert.strictEqual(wrapper.querySelector('.live-amount-input-words-label').textContent, 'In words');
    edit('9');
    assert.strictEqual(input.validationMessage, 'Too small');
    edit('101');
    assert.strictEqual(input.validationMessage, 'Too large');
  });

  it('prevents clearing disabled or read-only fields and restores editing when enabled', async () => {
    await render();
    const clear = wrapper.querySelector('button');
    model.enabled = false;
    await settle();
    assert.strictEqual(input.disabled, true);
    clear.dispatchEvent(new window.Event('click'));
    assert.strictEqual(model.value, 12345.67);
    model.enabled = true;
    model.readOnly = true;
    await settle();
    assert.strictEqual(input.readOnly, true);
    assert.strictEqual(clear.disabled, true);
    model.readOnly = false;
    await settle();
    assert.strictEqual(input.disabled, false);
    assert.strictEqual(clear.disabled, false);
  });
});
