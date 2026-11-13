import {
  test, expect, renderForm, loadFormJson, field, getModel, setModel, trackChanges,
} from '../form-harness.js';

const formDef = loadFormJson('live-amount-input');
const FIELD = 'field-under-test';
const sampleWords = 'Rupees Twelve Thousand Three Hundred Forty Five and Sixty Seven Paise Only';

test.describe('live-amount-input custom component', () => {
  test.beforeEach(async ({ page, formServer }) => {
    await renderForm(page, formServer, formDef);
  });

  test('renders the reference card with an accessible read-only output', async ({ page }) => {
    const wrapper = field(page, FIELD);
    await expect(wrapper).toHaveAttribute('data-component-status', 'loaded');
    await expect(wrapper.locator('.live-amount-input-title')).toHaveText('live-amount-input');
    await expect(wrapper.locator('.live-amount-input-prefix')).toHaveText('\u20b9');
    await expect(wrapper.getByLabel('Amount', { exact: true })).toHaveValue('12,345.67');
    await expect(wrapper.getByRole('status', { name: 'Amount (in words)' })).toHaveText(sampleWords);
    await expect(wrapper.locator('.live-amount-input-readonly')).toHaveText('Read-only');
    await expect(wrapper.getByRole('button', { name: 'Clear amount' })).toBeVisible();
    await expect(wrapper.locator('input')).toHaveJSProperty('required', true);
  });

  test('applies all authored labels and preserves numeric limits', async ({ page, formServer }) => {
    const variant = structuredClone(formDef);
    variant.items[0].properties = {
      title: 'Transfer amount',
      subtitle: 'Enter your transfer in INR',
      wordsLabel: 'Your amount in words',
      readOnlyLabel: 'Automatically calculated',
    };
    variant.items[0].minimum = 10;
    variant.items[0].maximum = 100;
    variant.items[0].default = 42;
    await renderForm(page, formServer, variant);
    const wrapper = field(page, FIELD);
    await expect(wrapper.locator('.live-amount-input-title')).toHaveText('Transfer amount');
    await expect(wrapper.locator('.live-amount-input-subtitle')).toHaveText('Enter your transfer in INR');
    await expect(wrapper.getByRole('status', { name: 'Your amount in words' })).toHaveText('Rupees Forty Two Only');
    await expect(wrapper.locator('.live-amount-input-readonly')).toHaveText('Automatically calculated');
    await wrapper.locator('input').fill('9');
    await expect(wrapper.locator('.field-description')).toHaveText('Enter an amount of at least 10.');
    await wrapper.locator('input').fill('101');
    await expect(wrapper.locator('.field-description')).toHaveText('Enter an amount no greater than 100.');
  });

  test('synchronizes prefill, lakh/crore, paise, zero, and reset from the model', async ({ page }) => {
    const wrapper = field(page, FIELD);
    const cases = [
      [100000.01, '1,00,000.01', 'Rupees One Lakh and One Paise Only'],
      [12345678.9, '1,23,45,678.9', 'Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight and Ninety Paise Only'],
      [0, '0', 'Rupees Zero Only'],
      [0.29, '0.29', 'Rupees Zero and Twenty Nine Paise Only'],
      [null, '', ''],
    ];
    for (const [value, display, words] of cases) {
      await setModel(page, FIELD, 'value', value);
      await expect(wrapper.locator('input')).toHaveValue(display);
      await expect(wrapper.locator('output')).toHaveText(words);
    }
    await expect(wrapper.getByRole('button', { name: 'Clear amount' })).toBeHidden();
  });

  test('updates words while typing and commits one numeric change on blur', async ({ page }) => {
    const wrapper = field(page, FIELD);
    const changes = await trackChanges(page, FIELD);
    const input = wrapper.locator('input');
    await input.fill('');
    await input.pressSequentially('98765.43');
    await expect(wrapper.locator('output')).toHaveText('Rupees Ninety Eight Thousand Seven Hundred Sixty Five and Forty Three Paise Only');
    expect(await getModel(page, FIELD)).toBe(12345.67);
    expect(await changes()).toBe(0);
    await field(page, 'next-field').locator('input').focus();
    await expect.poll(() => getModel(page, FIELD)).toBe(98765.43);
    await expect(input).toHaveValue('98,765.43');
    await expect.poll(changes).toBe(1);
  });

  test('accepts either grouping convention and keeps the editing caret stable', async ({ page }) => {
    const input = field(page, FIELD).locator('input');
    for (const amount of ['1,234,567.89', '12,34,567.89']) {
      await input.fill(amount);
      await field(page, 'next-field').locator('input').focus();
      await expect.poll(() => getModel(page, FIELD)).toBe(1234567.89);
      await expect(input).toHaveValue('12,34,567.89');
    }
    await input.fill('12345.67');
    for (let position = 0; position < 7; position += 1) await input.press('ArrowLeft');
    await input.press('9');
    await expect(input).toHaveValue('192345.67');
    expect(await input.evaluate((element) => element.selectionStart)).toBe(2);
  });

  test('shows invalid edits without committing or silently rounding them', async ({ page }) => {
    const wrapper = field(page, FIELD);
    const input = wrapper.locator('input');
    const changes = await trackChanges(page, FIELD);
    for (const value of ['-1', '1.234', '1e3', '12,34', 'abc', '1000000000']) {
      await input.fill(value);
      await expect(wrapper.locator('.field-description')).toContainText('Enter an amount from 0');
      await expect(wrapper.locator('output')).toHaveText('');
      expect(await input.evaluate((element) => element.checkValidity())).toBe(false);
      expect(await page.locator('form').evaluate((element) => element.checkValidity())).toBe(false);
      await field(page, 'next-field').locator('input').focus();
      expect(await getModel(page, FIELD)).toBe(12345.67);
    }
    expect(await changes()).toBe(0);
    await input.fill('19.99');
    await expect(wrapper).not.toHaveClass(/field-invalid/);
    await expect(wrapper.locator('output')).toHaveText('Rupees Nineteen and Ninety Nine Paise Only');
    await input.press('Tab');
    await expect.poll(() => getModel(page, FIELD)).toBe(19.99);
  });

  test('clears with the keyboard, commits once, and returns focus to the input', async ({ page }) => {
    const wrapper = field(page, FIELD);
    const changes = await trackChanges(page, FIELD);
    const input = wrapper.locator('input');
    await input.focus();
    await input.press('Tab');
    await expect(wrapper.getByRole('button', { name: 'Clear amount' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();
    await expect(wrapper.locator('output')).toHaveText('');
    await expect.poll(() => getModel(page, FIELD)).toBeNull();
    await expect.poll(changes).toBe(1);
    expect(await input.evaluate((element) => element.validity.valueMissing)).toBe(true);
    await input.press('Tab');
    await expect(field(page, 'next-field').locator('input')).toBeFocused();
  });

  test('honors disabled, read-only, and visibility changes', async ({ page }) => {
    const wrapper = field(page, FIELD);
    const input = wrapper.locator('input');
    const clear = wrapper.getByRole('button', { name: 'Clear amount' });
    await setModel(page, FIELD, 'enabled', false);
    await expect(input).toBeDisabled();
    await expect(clear).toBeDisabled();
    await setModel(page, FIELD, 'enabled', true);
    await expect(input).toBeEnabled();
    await expect(clear).toBeEnabled();
    await setModel(page, FIELD, 'readOnly', true);
    await expect(input).toHaveAttribute('readonly', '');
    await expect(clear).toBeDisabled();
    await setModel(page, FIELD, 'readOnly', false);
    await expect(input).not.toHaveAttribute('readonly', '');
    await expect(clear).toBeEnabled();
    await setModel(page, FIELD, 'visible', false);
    await expect(wrapper).toBeHidden();
    await setModel(page, FIELD, 'visible', true);
    await expect(wrapper).toBeVisible();
  });

  test('fits narrow screens without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    const wrapper = field(page, FIELD);
    await expect(wrapper).toBeVisible();
    expect(await wrapper.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
