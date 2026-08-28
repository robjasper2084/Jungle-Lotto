import type { Product } from '../commerce/types';
import { config } from '../config';
import { launchOwner } from '../content/launch';
import { createSubscription, disconnectedMessage, type LaunchInterest } from '../state/subscription';
import { analytics } from '../state/analytics';
import { $, $$, openDialog } from './dom';
let selection: LaunchInterest[] = [];
export function openLaunchAlert(interests: LaunchInterest[], trigger?: HTMLElement) {
  selection = interests;
  const form = $<HTMLFormElement>('#launch-alert-form')!;
  if (form.dataset.busy !== 'true') {
    form.reset();
    $('.form-status', form)!.textContent = config.newsletterEndpoint && launchOwner.subscriptionApproved
      ? 'Your consent is required. See the privacy notice before submitting.' : disconnectedMessage;
  }
  $('[data-launch-selection]')!.textContent = interests.length
    ? interests.map(item => item.handle.replaceAll('-', ' ') + ' · ' + item.size + ' / ' + item.color + ' × ' + item.quantity).join('; ')
    : 'General Drop 001 launch updates.';
  analytics.trackEvent('launch_alert_open', { count: interests.length });
  openDialog('launch-alert-dialog', trigger);
}
export function initSubscriptions(products: Product[]) {
  const service = createSubscription(config.newsletterEndpoint, launchOwner.subscriptionApproved);
  $$<HTMLFormElement>('[data-subscription-form]').forEach(form => {
    const status = $('.form-status', form)!;
    const email = $<HTMLInputElement>('[name=email]', form)!;
    const button = $<HTMLButtonElement>('[type=submit]', form)!;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity() || form.dataset.busy === 'true') return;
      const data = new FormData(form);
      const interests = form.dataset.loadoutAlert ? selection : [];
      if (interests.some(item => !products.some(p => p.handle === item.handle && p.variants.some(v => v.id === item.variantId && v.size === item.size && v.color === item.color)))) {
        status.textContent = 'Your saved options changed. Reopen your Launch Loadout to review them.'; return;
      }
      form.dataset.busy = 'true'; button.disabled = true;
      status.textContent = 'Checking your launch alert request…';
      const result = await service.subscribe({
        email: String(data.get('email') ?? ''), consent: data.get('consent') === 'on',
        source: location.pathname, interests,
        collection: products.find(p => p.handle === interests[0]?.handle)?.collection,
      });
      status.textContent = result.message;
      analytics.trackEvent(result.ok ? 'launch_alert_submit' : 'launch_alert_error', { count: interests.length });
      if (result.ok) form.reset();
      email.removeAttribute('aria-invalid');
      form.dataset.busy = 'false'; button.disabled = false;
    });
    form.addEventListener('invalid', event => {
      const input = event.target as HTMLInputElement;
      input.setAttribute('aria-invalid', 'true');
      status.textContent = input.name === 'consent' ? 'Please agree to receive launch emails before submitting.' : 'Enter a valid email address.';
    }, true);
    form.addEventListener('input', event => (event.target as HTMLInputElement).removeAttribute('aria-invalid'));
  });
  $('#launch-alert-dialog')?.addEventListener('close', () => {
    const form = $<HTMLFormElement>('#launch-alert-form')!;
    form.reset(); // No email is persisted, including between closed dialogs.
  });
}
