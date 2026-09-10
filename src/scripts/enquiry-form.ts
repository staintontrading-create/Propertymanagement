/**
 * Progressive enhancement shared by the quote request panel and the contact
 * form.
 *
 * - Pre-selects the service from a `?service=<slug>` query string.
 * - With a form endpoint configured (data-endpoint): submits with fetch and
 *   shows an inline status instead of leaving the page. Without JavaScript the
 *   form posts to the endpoint natively.
 * - Without an endpoint: composes a mailto: link from the fields so the
 *   visitor's email app opens with the message filled in. Without JavaScript
 *   the form's mailto: action with text/plain encoding does the same, less
 *   tidily.
 * - Honeypot: if the hidden "website" field is filled, nothing is sent and a
 *   success message is shown.
 */

function fieldLabel(form: HTMLFormElement, field: Element): string {
  const id = field.getAttribute('id');
  const label = id ? form.querySelector<HTMLLabelElement>(`label[for="${id}"]`) : null;
  const text = label?.querySelector('.field__label-text')?.textContent ?? label?.textContent ?? field.getAttribute('name') ?? '';
  return text.replace(/\s+/g, ' ').trim();
}

function composeBody(form: HTMLFormElement): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) continue;
    if (!el.name || el.type === 'hidden' || el.type === 'submit' || el.name === 'website') continue;
    if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
      if (!el.checked) continue;
      const legend = el.closest('fieldset')?.querySelector('legend')?.textContent?.trim();
      const key = legend ?? fieldLabel(form, el);
      const value = el.type === 'checkbox' && el.value === 'on' ? 'yes' : (el.labels?.[0]?.textContent?.trim() ?? el.value);
      lines.push(`${key}: ${value}`);
      continue;
    }
    if (seen.has(el.name)) continue;
    seen.add(el.name);
    let value = el.value.trim();
    if (el instanceof HTMLSelectElement) value = el.selectedOptions[0]?.textContent?.trim() ?? value;
    if (!value) continue;
    lines.push(`${fieldLabel(form, el)}: ${value}`);
  }
  return lines.join('\n');
}

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const DASH_GLYPH =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 12h12"></path></svg>';

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function isControl(el: Element): el is FormControl {
  return el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;
}

export function enhanceEnquiryForm(form: HTMLFormElement): void {
  // The markup keeps native validation for the no-JavaScript path; from here on
  // the script validates and reports, so the browser's own bubbles are turned off.
  form.noValidate = true;
  const endpoint = form.dataset.endpoint ?? '';
  const mailto = form.dataset.mailto ?? '';
  const subject = form.dataset.subject ?? 'Website enquiry';
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const honeypot = form.querySelector<HTMLInputElement>('input[name="website"]');
  const select = form.querySelector<HTMLSelectElement>('select[name="service"]');
  const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');

  const wanted = new URLSearchParams(window.location.search).get('service');
  if (wanted && select && Array.from(select.options).some((o) => o.value === wanted)) select.value = wanted;

  const show = (state: 'success' | 'error' | 'mailto', html: string, focus = true) => {
    if (!status) return;
    status.dataset.state = state;
    status.innerHTML = html;
    if (focus) status.focus?.();
  };
  const clearStatus = () => {
    if (!status) return;
    delete status.dataset.state;
    status.innerHTML = '';
  };

  const contactFallback = mailto ? ` You can also email <a href="mailto:${mailto}">${mailto}</a>.` : '';

  // --- Validation feedback: text and a glyph per field, aria-invalid, and a
  // summary in the live region, on top of the browser's native validation.
  const controls = (): FormControl[] =>
    Array.from(form.elements).filter((el): el is FormControl => isControl(el) && Boolean(el.name) && el.type !== 'hidden' && el.name !== 'website');
  const errorId = (el: FormControl) => `${el.id || el.name}-error`;
  const describedBy = (el: FormControl, id: string, add: boolean) => {
    const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((x) => x && x !== id);
    if (add) ids.push(id);
    if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
    else el.removeAttribute('aria-describedby');
  };
  const labelOf = (el: FormControl) => (el instanceof HTMLInputElement && el.type === 'checkbox' ? 'Consent' : fieldLabel(form, el));
  const clearFieldError = (el: FormControl) => {
    el.removeAttribute('aria-invalid');
    document.getElementById(errorId(el))?.remove();
    describedBy(el, errorId(el), false);
  };
  const showFieldError = (el: FormControl) => {
    el.setAttribute('aria-invalid', 'true');
    const id = errorId(el);
    let message = document.getElementById(id);
    if (!message) {
      message = document.createElement('p');
      message.className = 'field__error';
      message.id = id;
      (el.closest('.checkbox') ?? el).insertAdjacentElement('afterend', message);
    }
    message.innerHTML = `${DASH_GLYPH}<span>${escapeHtml(el.validationMessage || 'This field needs attention.')}</span>`;
    describedBy(el, id, true);
  };
  const validate = (): FormControl[] => {
    const invalid: FormControl[] = [];
    for (const el of controls()) {
      if (el.validity.valid) clearFieldError(el);
      else {
        showFieldError(el);
        invalid.push(el);
      }
    }
    return invalid;
  };
  const revalidateField = (event: Event) => {
    const el = event.target;
    if (!(el instanceof Element) || !isControl(el) || el.getAttribute('aria-invalid') !== 'true' || !el.validity.valid) return;
    clearFieldError(el);
    if (!form.querySelector('[aria-invalid="true"]')) clearStatus();
  };
  form.addEventListener('input', revalidateField);
  form.addEventListener('change', revalidateField);

  const setBusy = (busy: boolean) => {
    if (busy) {
      form.dataset.busy = 'true';
      form.setAttribute('aria-busy', 'true');
    } else {
      delete form.dataset.busy;
      form.removeAttribute('aria-busy');
    }
    if (submitButton) submitButton.disabled = busy;
  };

  form.addEventListener('submit', async (event) => {
    if (form.dataset.busy) {
      event.preventDefault();
      return;
    }

    const invalid = validate();
    if (invalid.length) {
      event.preventDefault();
      const n = invalid.length;
      const links = invalid.map((el) => `<a href="#${el.id}">${escapeHtml(labelOf(el))}</a>`).join(', ');
      show('error', `<strong>${n} field${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} attention:</strong> ${links}.`, false);
      invalid[0].focus();
      return;
    }
    clearStatus();

    if (honeypot && honeypot.value) {
      event.preventDefault();
      show('success', 'Thank you. Your message has been received.');
      form.reset();
      return;
    }

    if (endpoint) {
      event.preventDefault();
      setBusy(true);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });
        if (response.ok) {
          show('success', 'Thank you. Your message has been sent. You will hear back within one working day, in writing.');
          form.reset();
        } else {
          show('error', `Sorry, the message could not be sent.${contactFallback}`);
        }
      } catch {
        show('error', `Sorry, the message could not be sent.${contactFallback}`);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mailto) {
      event.preventDefault();
      const body = composeBody(form);
      window.location.href = `mailto:${mailto}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      show('mailto', `Your email app should open with the message filled in. If it does not, email <a href="mailto:${mailto}">${mailto}</a> and paste in your details.`);
    }
  });
}

document.querySelectorAll<HTMLFormElement>('form[data-enquiry-form]').forEach(enhanceEnquiryForm);
