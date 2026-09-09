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

export function enhanceEnquiryForm(form: HTMLFormElement): void {
  const endpoint = form.dataset.endpoint ?? '';
  const mailto = form.dataset.mailto ?? '';
  const subject = form.dataset.subject ?? 'Website enquiry';
  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const honeypot = form.querySelector<HTMLInputElement>('input[name="website"]');
  const select = form.querySelector<HTMLSelectElement>('select[name="service"]');

  const wanted = new URLSearchParams(window.location.search).get('service');
  if (wanted && select && Array.from(select.options).some((o) => o.value === wanted)) select.value = wanted;

  const show = (state: 'success' | 'error' | 'mailto', html: string) => {
    if (!status) return;
    status.dataset.state = state;
    status.innerHTML = html;
    status.focus?.();
  };

  const contactFallback = mailto
    ? ` You can also email <a href="mailto:${mailto}">${mailto}</a>.`
    : '';

  form.addEventListener('submit', async (event) => {
    if (!form.checkValidity()) return; // let the browser show its validation messages

    if (honeypot && honeypot.value) {
      event.preventDefault();
      show('success', 'Thank you. Your message has been received.');
      form.reset();
      return;
    }

    if (endpoint) {
      event.preventDefault();
      form.dataset.busy = 'true';
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
        delete form.dataset.busy;
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
