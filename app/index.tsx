// Root index — redirect to the home tab so launching `ashitakanji:///`
// resolves to a real route instead of expo-router's Unmatched Route screen.

import { Redirect } from 'expo-router';

export default function Index(): React.ReactNode {
  return <Redirect href="/home" />;
}
