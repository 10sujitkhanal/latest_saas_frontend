/**
 * Per-node-type form schemas + output-variable declarations.
 *
 * Drives the SETUP tab of the node config drawer (typed widgets instead
 * of raw JSON) and the VARIABLES tab (each upstream node's `outputs`
 * become pickable chips so downstream nodes can interpolate them via
 * `{{var.path}}`).
 *
 * Adding a new node type? Just append a schema below. Anything without
 * an entry falls back to the legacy JSON editor — nothing breaks.
 */

export type FieldType =
  | 'text'
  | 'multiline'
  | 'number'
  | 'select'
  | 'switch'
  | 'duration_hours'      // pretty editor that converts "2 days" → 48
  | 'channel_kind'        // pre-filled dropdown of message channels
  | 'ai_provider'         // pre-filled dropdown of AI providers (label-only)
  | 'credential_picker'   // pick a connected Channel row (real saved credential)
  | 'stage_slug'          // pipeline stage picker
  | 'tag';

export interface NodeFieldSpec {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
  required?: boolean;
  default?: unknown;
  /** If true, this field accepts `{{variable}}` references from upstream nodes. */
  supportsVariables?: boolean;
  /** For credential_picker: which Channel.kind values qualify. The
   *  drawer fetches connected Channels and filters to these kinds. */
  credential_kinds?: string[];
  /** Friendly label shown in the empty-state CTA, e.g. "email provider". */
  credential_label?: string;
}

export interface NodeOutput {
  key: string;        // e.g. 'lead.email'
  label: string;      // e.g. 'Lead email'
  description?: string;
}

export interface NodeSchema {
  code: string;
  /** Header subtitle: 'Core Triggers', 'Apps · Email', etc. */
  category_label: string;
  /** Per-node colour for header badge + tab underline. */
  accent: string;
  /** Optional one-liner shown under the title in the drawer header. */
  description?: string;
  fields: NodeFieldSpec[];
  outputs?: NodeOutput[];
}

// ──────────────────────────────────────────────────────────────────────
//  Shared output sets — keep these in one place so node schemas stay tidy.
// ──────────────────────────────────────────────────────────────────────

const LEAD_OUTPUTS: NodeOutput[] = [
  { key: 'lead.id',           label: 'Lead ID' },
  { key: 'lead.first_name',   label: 'First name' },
  { key: 'lead.last_name',    label: 'Last name' },
  { key: 'lead.email',        label: 'Email' },
  { key: 'lead.phone',        label: 'Phone' },
  { key: 'lead.source',       label: 'Source name' },
  { key: 'lead.source_slug',  label: 'Source slug' },
  { key: 'lead.stage',        label: 'Stage name' },
  { key: 'lead.stage_slug',   label: 'Stage slug' },
  { key: 'lead.score',        label: 'Score' },
  { key: 'lead.status',       label: 'Status' },
  { key: 'lead.value',        label: 'Deal value' },
  { key: 'lead.assigned_to',  label: 'Owner email' },
  { key: 'lead.created_at',   label: 'Created at' },
];

const MESSAGE_OUTPUTS: NodeOutput[] = [
  { key: 'message.body',         label: 'Message body' },
  { key: 'message.channel',      label: 'Channel kind (instagram / whatsapp / …)' },
  { key: 'message.contact_name', label: 'Contact name' },
  { key: 'message.received_at',  label: 'Received at' },
];

const APPOINTMENT_OUTPUTS: NodeOutput[] = [
  { key: 'appointment.id',         label: 'Appointment ID' },
  { key: 'appointment.title',      label: 'Title' },
  { key: 'appointment.starts_at',  label: 'Start time' },
  { key: 'appointment.duration',   label: 'Duration (minutes)' },
  { key: 'appointment.meet_link',  label: 'Meet link' },
];

// ──────────────────────────────────────────────────────────────────────
//  Schemas
// ──────────────────────────────────────────────────────────────────────

export const NODE_SCHEMAS: Record<string, NodeSchema> = {
  // ─── Triggers ─────────────────────────────────────────────────────
  manual: {
    code: 'manual',
    category_label: 'Core triggers',
    accent: '#10b981',
    description: 'Fires when a staff member runs this workflow by hand.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Manual Trigger',
        placeholder: 'e.g. Re-engage cold lead' },
    ],
    outputs: LEAD_OUTPUTS,
  },

  inbound_message: {
    code: 'inbound_message',
    category_label: 'Core triggers',
    accent: '#10b981',
    description: 'Fires when a new message arrives on one of your connected social channels.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Message Received' },
      { key: 'channel_kind', label: 'Channel (optional)', type: 'channel_kind',
        help: 'Leave blank to fire on any channel. Pick one to scope this workflow.' },
    ],
    outputs: [...MESSAGE_OUTPUTS, ...LEAD_OUTPUTS],
  },

  lead_created: {
    code: 'lead_created',
    category_label: 'Core triggers',
    accent: '#10b981',
    description: 'Fires the moment a new lead row is created.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Lead Created' },
      { key: 'source_slug', label: 'Lead source filter (optional)', type: 'select',
        options: [
          { value: '',          label: 'Any source' },
          { value: 'website',   label: 'Website' },
          { value: 'referral',  label: 'Referral' },
          { value: 'instagram', label: 'Instagram' },
          { value: 'facebook',  label: 'Facebook' },
          { value: 'whatsapp',  label: 'WhatsApp' },
          { value: 'csv',       label: 'CSV import' },
        ],
        help: 'Only fire when the lead\'s source matches.' },
    ],
    outputs: LEAD_OUTPUTS,
  },

  appointment_booked: {
    code: 'appointment_booked',
    category_label: 'Core triggers',
    accent: '#10b981',
    description: 'Fires when someone books on your public scheduling link.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Appointment Created' },
    ],
    outputs: [...APPOINTMENT_OUTPUTS, ...LEAD_OUTPUTS],
  },

  form_submitted: {
    code: 'form_submitted',
    category_label: 'Core triggers',
    accent: '#10b981',
    description: 'Fires when a specific automation form is submitted.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Form Submitted' },
      { key: 'form_slug', label: 'Form slug (optional)', type: 'text',
        placeholder: 'e.g. contact-us', help: 'Leave blank for any form.' },
    ],
    outputs: LEAD_OUTPUTS,
  },

  scheduled_time: {
    code: 'scheduled_time',
    category_label: 'Core triggers',
    accent: '#10b981',
    description: 'Runs on a recurring schedule.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Scheduled Time' },
      { key: 'cron', label: 'Cron expression', type: 'text',
        placeholder: '0 9 * * *', help: 'Default: every day at 9am (0 9 * * *).' },
    ],
    outputs: [],
  },

  webhook_received: {
    code: 'webhook_received',
    category_label: 'Core triggers',
    accent: '#10b981',
    description: 'Triggers on incoming HTTP request.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Webhook Received' },
      { key: 'secret', label: 'Webhook secret (optional)', type: 'text',
        placeholder: 'random string', help: 'Validates the X-Webhook-Secret header.' },
    ],
    outputs: [
      { key: 'webhook.payload', label: 'Full request body (JSON)' },
      { key: 'webhook.headers', label: 'Request headers' },
    ],
  },

  // ─── Logic ────────────────────────────────────────────────────────
  if_condition: {
    code: 'if_condition',
    category_label: 'Logic',
    accent: '#3b82f6',
    description: 'Single comparison with TRUE / FALSE branches.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'If condition' },
      { key: 'field', label: 'Field', type: 'text', placeholder: 'score / value / source_slug',
        supportsVariables: true, required: true },
      { key: 'op', label: 'Operator', type: 'select', required: true, options: [
        { value: 'gte', label: '≥ (greater than or equal)' },
        { value: 'lte', label: '≤ (less than or equal)' },
        { value: 'gt',  label: '> (greater than)' },
        { value: 'lt',  label: '< (less than)' },
        { value: 'eq',  label: '= (equals)' },
      ] },
      { key: 'value', label: 'Compare to', type: 'text', placeholder: '50',
        supportsVariables: true, required: true },
    ],
    outputs: [
      { key: 'condition.matched', label: 'Whether the branch matched (boolean)' },
    ],
  },

  switch_case: {
    code: 'switch_case',
    category_label: 'Logic',
    accent: '#3b82f6',
    description: 'Route by comparison rules — one output port per matching rule.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Switch case' },
      { key: 'rules', label: 'Rules (JSON list)', type: 'multiline',
        placeholder: '[{"name":"website","when":"source_slug == website"}]',
        help: 'Each rule becomes a labelled output port.' },
    ],
  },

  formatter: {
    code: 'formatter',
    category_label: 'Logic',
    accent: '#3b82f6',
    description: 'Transform a value — uppercase, trim, date format, etc.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Formatter' },
      { key: 'input', label: 'Input', type: 'text', supportsVariables: true, required: true },
      { key: 'transform', label: 'Transform', type: 'select', required: true, options: [
        { value: 'uppercase', label: 'UPPERCASE' },
        { value: 'lowercase', label: 'lowercase' },
        { value: 'title',     label: 'Title Case' },
        { value: 'trim',      label: 'Trim whitespace' },
        { value: 'date_iso',  label: 'Date → ISO' },
      ] },
    ],
    outputs: [{ key: 'formatter.output', label: 'Transformed value' }],
  },

  stop: {
    code: 'stop',
    category_label: 'Logic',
    accent: '#ef4444',
    description: 'Short-circuit — stop the flow here.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Stop' },
    ],
  },

  else_branch: {
    code: 'else_branch',
    category_label: 'Logic',
    accent: '#f43f5e',
    description: 'Fallback action when the primary conditions did not match.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Otherwise' },
      { key: 'then_text', label: 'What to do otherwise', type: 'multiline',
        placeholder: 'send a generic intro email' },
    ],
  },

  // ─── Timer ────────────────────────────────────────────────────────
  wait: {
    code: 'wait',
    category_label: 'Timer',
    accent: '#f59e0b',
    description: 'Pause the flow before continuing.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Wait' },
      { key: 'delay_hours', label: 'Delay', type: 'duration_hours', required: true, default: 1,
        help: 'How long to wait before the next node runs.' },
    ],
  },

  // ─── AI tools / Knowledge base ────────────────────────────────────
  ai_reply: {
    code: 'ai_reply',
    category_label: 'AI Tools',
    accent: '#10b981',
    description: 'Call the LLM and post the reply into the lead\'s conversation. Auto-uses your Knowledge Base if any docs are trained.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'AI Reply' },
      { key: 'credential_id', label: 'AI credential', type: 'credential_picker', required: true,
        credential_kinds: ['openai', 'anthropic', 'gemini', 'mistral', 'groq', 'cohere', 'together', 'openrouter', 'azure_openai', 'ollama'],
        credential_label: 'AI provider',
        help: 'Pick which connected AI provider to use for this node.' },
      { key: 'system_prompt', label: 'System prompt (optional)', type: 'multiline',
        placeholder: 'You are a helpful sales assistant for Acme Corp.',
        supportsVariables: true,
        help: 'Custom instructions prepended to every AI call.' },
    ],
    outputs: [
      { key: 'ai.answer',        label: 'AI-generated reply text' },
      { key: 'ai.provider_used', label: 'Provider that handled the call' },
      { key: 'ai.sources_count', label: 'Number of KB sources cited' },
    ],
  },

  chat_with_kb: {
    code: 'chat_with_kb',
    category_label: 'Knowledge Base',
    accent: '#06b6d4',
    description: 'Forced retrieval-augmented reply — AI grounds its answer in your trained docs.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Chat with Knowledge Base' },
      { key: 'credential_id', label: 'AI credential', type: 'credential_picker', required: true,
        credential_kinds: ['openai', 'anthropic', 'gemini', 'mistral', 'groq', 'cohere'],
        credential_label: 'AI provider',
        help: 'Pick the AI that should answer using your trained KB.' },
      { key: 'top_k', label: 'How many sources to retrieve', type: 'number', default: 5 },
    ],
    outputs: [
      { key: 'ai.answer',  label: 'Grounded reply text' },
      { key: 'ai.sources', label: 'Cited source chunks' },
    ],
  },

  chat_with_ai: {
    code: 'chat_with_ai',
    category_label: 'AI Tools',
    accent: '#10b981',
    description: 'Plain LLM call — no retrieval. Useful for sanity-checks.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Chat with AI' },
      { key: 'credential_id', label: 'AI credential', type: 'credential_picker', required: true,
        credential_kinds: ['openai', 'anthropic', 'gemini', 'mistral', 'groq', 'cohere'],
        credential_label: 'AI provider' },
      { key: 'system_prompt', label: 'System prompt', type: 'multiline', supportsVariables: true },
    ],
    outputs: [{ key: 'ai.answer', label: 'Generated reply text' }],
  },

  // ─── Apps · Email ─────────────────────────────────────────────────
  send_email: {
    code: 'send_email',
    category_label: 'Apps · Email',
    accent: '#3b82f6',
    description: 'Send an outbound email via your connected SMTP credential.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Send Email' },
      { key: 'credential_id', label: 'Email credential', type: 'credential_picker', required: true,
        credential_kinds: ['email', 'gmail', 'outlook', 'sendgrid', 'mailgun', 'smtp'],
        credential_label: 'email provider',
        help: 'Pick which mailbox / SMTP credential to send from.' },
      { key: 'to', label: 'To', type: 'text', supportsVariables: true,
        placeholder: '{{lead.email}}', required: true },
      { key: 'subject', label: 'Subject', type: 'text', supportsVariables: true,
        placeholder: 'Welcome to Acme, {{lead.first_name}}!', required: true },
      { key: 'body', label: 'Body', type: 'multiline', supportsVariables: true,
        placeholder: 'Hi {{lead.first_name}}, thanks for signing up.', required: true },
      { key: 'delay_hours', label: 'Delay before sending', type: 'duration_hours', default: 0 },
    ],
    outputs: [
      { key: 'email.message_id', label: 'Sent email ID' },
      { key: 'email.sent_at',    label: 'Sent at' },
    ],
  },

  reply_email: {
    code: 'reply_email',
    category_label: 'Apps · Email',
    accent: '#3b82f6',
    description: 'Reply to the email thread that triggered the flow.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Reply Email' },
      { key: 'credential_id', label: 'Email credential', type: 'credential_picker', required: true,
        credential_kinds: ['email', 'gmail', 'outlook', 'sendgrid', 'mailgun', 'smtp'],
        credential_label: 'email provider' },
      { key: 'body', label: 'Body', type: 'multiline', supportsVariables: true, required: true },
    ],
  },

  // ─── Apps · WhatsApp ──────────────────────────────────────────────
  send_whatsapp: {
    code: 'send_whatsapp',
    category_label: 'Apps · WhatsApp',
    accent: '#25d366',
    description: 'Send a WhatsApp message via your connected number.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Send WhatsApp' },
      { key: 'credential_id', label: 'WhatsApp credential', type: 'credential_picker', required: true,
        credential_kinds: ['whatsapp', 'whatsapp_cloud', 'twilio'],
        credential_label: 'WhatsApp provider' },
      { key: 'to', label: 'To phone', type: 'text', supportsVariables: true,
        placeholder: '{{lead.phone}}', required: true },
      { key: 'body', label: 'Message', type: 'multiline', supportsVariables: true, required: true },
      { key: 'delay_hours', label: 'Delay before sending', type: 'duration_hours', default: 0 },
    ],
  },

  // ─── Apps · Twilio ────────────────────────────────────────────────
  twilio_sms: {
    code: 'twilio_sms',
    category_label: 'Apps · Twilio',
    accent: '#f22f46',
    description: 'Send an SMS via Twilio.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Send SMS' },
      { key: 'credential_id', label: 'Twilio credential', type: 'credential_picker', required: true,
        credential_kinds: ['twilio'], credential_label: 'Twilio account' },
      { key: 'to', label: 'To phone', type: 'text', supportsVariables: true,
        placeholder: '+1...', required: true },
      { key: 'body', label: 'Message', type: 'multiline', supportsVariables: true, required: true },
    ],
  },

  // ─── Apps · Generic channel ───────────────────────────────────────
  send_via_channel: {
    code: 'send_via_channel',
    category_label: 'Apps',
    accent: '#8b5cf6',
    description: 'Send via a specific channel (Instagram, Facebook, LinkedIn, etc.).',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Send via channel' },
      { key: 'credential_id', label: 'Channel credential', type: 'credential_picker', required: true,
        credential_kinds: ['instagram', 'facebook', 'messenger', 'linkedin', 'tiktok', 'whatsapp', 'sms', 'twilio'],
        credential_label: 'social channel' },
      { key: 'body', label: 'Message', type: 'multiline', supportsVariables: true, required: true },
      { key: 'delay_hours', label: 'Delay before sending', type: 'duration_hours', default: 0 },
    ],
  },

  // ─── CRM mutations ────────────────────────────────────────────────
  create_task: {
    code: 'create_task',
    category_label: 'CRM',
    accent: '#ec4899',
    description: 'Queue an internal task for the lead\'s assignee.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Create task' },
      { key: 'title', label: 'Task title', type: 'text', supportsVariables: true, required: true },
      { key: 'kind', label: 'Kind', type: 'select', default: 'task', options: [
        { value: 'task',    label: 'Task' },
        { value: 'call',    label: 'Phone call' },
        { value: 'meeting', label: 'Meeting' },
        { value: 'email',   label: 'Email follow-up' },
      ] },
      { key: 'delay_hours', label: 'Due in', type: 'duration_hours', default: 0 },
    ],
    outputs: [{ key: 'task.id', label: 'Created task ID' }],
  },

  move_stage: {
    code: 'move_stage',
    category_label: 'CRM',
    accent: '#ec4899',
    description: 'Move the lead through the pipeline.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Move stage' },
      { key: 'target_slug', label: 'Target stage', type: 'stage_slug', required: true },
      { key: 'delay_hours', label: 'Delay', type: 'duration_hours', default: 0 },
    ],
  },

  add_tag: {
    code: 'add_tag',
    category_label: 'CRM',
    accent: '#8b5cf6',
    description: 'Add a tag to the lead.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Add tag' },
      { key: 'tag', label: 'Tag', type: 'tag', required: true,
        placeholder: 'hot-lead' },
    ],
  },

  add_score: {
    code: 'add_score',
    category_label: 'CRM',
    accent: '#f97316',
    description: 'Adjust the lead\'s numeric score.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Adjust score' },
      { key: 'points', label: 'Points (use negative to subtract)', type: 'number',
        required: true, default: 10 },
    ],
  },

  assign_to: {
    code: 'assign_to',
    category_label: 'CRM',
    accent: '#06b6d4',
    description: 'Assign the lead to a staff member.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Assign to' },
      { key: 'assignee_hint', label: 'Staff email or substring', type: 'text', required: true,
        placeholder: 'sarah@acme.com' },
    ],
  },

  notify_owner: {
    code: 'notify_owner',
    category_label: 'CRM',
    accent: '#a855f7',
    description: 'Send the lead\'s owner an in-app + email notification.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Notify owner' },
      { key: 'message', label: 'Message (optional)', type: 'multiline', supportsVariables: true,
        placeholder: 'Lead {{lead.first_name}} just hit score 75' },
    ],
  },

  book_appointment: {
    code: 'book_appointment',
    category_label: 'CRM',
    accent: '#8b5cf6',
    description: 'Create an Appointment row + (if Google Calendar is connected) a Meet link.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Book appointment' },
      { key: 'title', label: 'Appointment title', type: 'text', supportsVariables: true,
        default: 'Meeting' },
      { key: 'duration_minutes', label: 'Duration (minutes)', type: 'number', default: 30 },
      { key: 'delay_hours', label: 'Delay before booking', type: 'duration_hours', default: 0 },
    ],
    outputs: APPOINTMENT_OUTPUTS,
  },

  send_link: {
    code: 'send_link',
    category_label: 'Apps',
    accent: '#22c55e',
    description: 'Send a booking / payment / portal link to the lead.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Send link' },
      { key: 'link_kind', label: 'Link type', type: 'select', default: 'booking', options: [
        { value: 'booking',  label: 'Booking link' },
        { value: 'payment',  label: 'Payment link' },
        { value: 'portal',   label: 'Customer portal' },
        { value: 'calendar', label: 'Calendar link' },
      ] },
      { key: 'delay_hours', label: 'Delay', type: 'duration_hours', default: 0 },
    ],
  },

  send_confirmation: {
    code: 'send_confirmation',
    category_label: 'Apps',
    accent: '#34d399',
    description: 'Send a quick confirmation / thank-you / welcome message.',
    fields: [
      { key: 'label', label: 'Display name', type: 'text', default: 'Send confirmation' },
      { key: 'title', label: 'Subject / title', type: 'text', supportsVariables: true,
        default: 'Confirmation' },
      { key: 'delay_hours', label: 'Delay', type: 'duration_hours', default: 0 },
    ],
  },
};

export function schemaFor(code: string): NodeSchema | null {
  return NODE_SCHEMAS[code] || null;
}
