import type { ProcessStep } from './types';

/**
 * The five steps every engagement follows. Rendered as the Ledger on the home
 * page, the services overview and the about page, so the promise is worded
 * identically everywhere.
 */
export const processSteps: ProcessStep[] = [
  {
    title: 'First conversation',
    text: 'Call, message or write. We ask what worries you about the property and what you want to hear from us, and how often.',
    youReceive: 'a written note of what we discussed and what we propose to do next.',
  },
  {
    title: 'Walk-through, written scope and your approval threshold',
    text: 'We visit the property, then send a scope with costs before anything starts. We agree an amount up to which we can act without asking; anything above it waits for your yes.',
    youReceive: 'a scope document with costs and your agreed approval threshold in writing.',
  },
  {
    title: 'One named contact',
    text: 'A phone number and an email address that belong to a person, not a department. That person coordinates every trade, cleaner and supplier on your behalf.',
    youReceive: 'the name, number and email of the person responsible for your property.',
  },
  {
    title: 'Work and visits reported with photographs',
    text: 'After every visit or job, a dated report with photographs, sent the same day or the next working day, saying what was found, what was done and what needs a decision.',
    youReceive: 'a photo report after every visit, stored in a folder you can open at any time.',
  },
  {
    title: 'Monthly summary and a standing invitation',
    text: 'Once a month, a short summary of visits, spend against the scope, and anything coming up. Any question, any time, answered in writing.',
    youReceive: 'a monthly summary and an answer to every question, in writing.',
  },
];
