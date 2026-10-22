import AppNavigator from "./navigation/AppNavigator";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from './context/SessionContext';
import { SavedProvider } from './context/SavedContext';

export default function App() {
  return <SafeAreaProvider><SessionProvider><SavedProvider><AppNavigator /></SavedProvider></SessionProvider></SafeAreaProvider>;
}
