export type AppEvent = {
  id: string;
  title: string;
  category?: string;
  organizer: string;
  date: string;
  time?: string;
  location: string;
  description?: string;
  attendees?: {
    registered: number;
    capacity?: number;
  };
  registrationDeadline?: string;
  price?: string; // e.g. 'Free' or 'Paid'
  /** local require(...) or remote url */
  image?: any;
};

export const sampleEvents: AppEvent[] = [
  {
    id: '1',
    title: 'Annual Tech Summit 2024',
    category: 'Technology',
    organizer: 'Computer Science Society',
    date: 'Oct 15, 2024',
    time: '9:00 AM - 5:00 PM',
    location: 'Main Auditorium',
    description:
      'Join us for the biggest tech event of the year featuring keynote speakers from leading tech companies, startup pitches, and hands-on workshops.',
    attendees: { registered: 156, capacity: 200 },
    registrationDeadline: 'Oct 13, 2024',
    price: 'Free',
  image: require('../assets/images/icon.png'),
  },
  {
    id: '2',
    title: 'Tech Workshop: Mobile App Development',
    category: 'Technology',
    organizer: 'Computing Society',
    date: 'Oct 20, 2025',
    time: '10:00 AM - 1:00 PM',
    location: 'Lab Complex',
    description: 'Build your first cross-platform mobile app with Expo and React Native.',
    attendees: { registered: 48, capacity: 60 },
    registrationDeadline: 'Oct 18, 2025',
    price: 'Free',
  image: require('../assets/images/icon.png'),
  },
  {
    id: '3',
    title: 'Cultural Night 2025',
    category: 'Cultural',
    organizer: 'Cultural Society',
    date: 'Nov 1, 2025',
    time: '6:00 PM',
    location: 'Open Air Theatre',
    description: 'An evening of music and dance from groups across campus.',
    attendees: { registered: 320, capacity: 500 },
    registrationDeadline: 'Oct 30, 2025',
    price: 'Paid',
  image: require('../assets/images/icon.png'),
  },
  {
    id: '4',
    title: 'Programming Contest 2025',
    category: 'Technology',
    organizer: 'IEEE Student Branch',
    date: 'Oct 25, 2025',
    time: '9:00 AM',
    location: 'Computer Lab A',
    description: 'Competitive programming contest with prizes for top teams.',
    attendees: { registered: 72, capacity: 100 },
    registrationDeadline: 'Oct 23, 2025',
    price: 'Free',
  image: require('../assets/images/icon.png'),
  },
];
