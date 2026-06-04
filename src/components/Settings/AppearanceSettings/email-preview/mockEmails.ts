export interface MockEmail {
  id: string;
  sender: string;
  subject: string;
  preview: string;
  date: string;
  categoryColor: string;
  category: string;
  isUnread: boolean;
  hasAttachment: boolean;
}

export const MOCK_EMAILS: MockEmail[] = [
  {
    id: '1',
    sender: 'GitHub Notifications',
    subject: '[MailVault] 3 new pull request reviews',
    preview: 'renovate[bot] approved your PR #142: Update deps...',
    date: 'Today, 10:42',
    categoryColor: '#0d9488',
    category: 'Dev',
    isUnread: true,
    hasAttachment: false,
  },
  {
    id: '2',
    sender: 'Stripe',
    subject: 'Your invoice from Stripe — $49.00',
    preview: 'A payment of $49.00 was charged to your Visa ending in 4242...',
    date: 'Today, 09:15',
    categoryColor: '#16a34a',
    category: 'Finance',
    isUnread: false,
    hasAttachment: true,
  },
  {
    id: '3',
    sender: 'Booking.com',
    subject: 'Your trip to Lisbon is confirmed!',
    preview: 'Check-in: Jun 14, 2025. Hotel Bairro Alto. Ref: BKG-44821...',
    date: 'Yesterday',
    categoryColor: '#2563eb',
    category: 'Travel',
    isUnread: true,
    hasAttachment: false,
  },
  {
    id: '4',
    sender: 'Medium Daily Digest',
    subject: 'Your weekly reading list is ready',
    preview: 'Top stories: The future of AI agents, How to build...',
    date: 'Jun 2',
    categoryColor: '#d97706',
    category: 'Newsletter',
    isUnread: false,
    hasAttachment: false,
  },
  {
    id: '5',
    sender: 'Netflix',
    subject: 'Your monthly subscription receipt',
    preview: 'Thank you for being a Netflix member. Your payment of...',
    date: 'Jun 1',
    categoryColor: '#7c3aed',
    category: 'Subscriptions',
    isUnread: false,
    hasAttachment: false,
  },
];

export function senderInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function senderColorHash(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hues = ['#0d9488', '#16a34a', '#2563eb', '#d97706', '#7c3aed', '#dc2626'];
  return hues[h % hues.length];
}
