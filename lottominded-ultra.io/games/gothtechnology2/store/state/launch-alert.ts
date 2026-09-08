import { config } from '../config.ts';
import { launchOwner } from '../content/launch.ts';

// Keep every alert entry point aligned with the form's connection gate.
export const launchAlertsConnected = Boolean(config.newsletterEndpoint && launchOwner.subscriptionApproved);
export const launchAlertLabel = launchAlertsConnected ? 'Get Launch Alert' : 'Alerts coming soon';
