import AppNavigator from "./navigation/AppNavigator";
import { SavedProvider } from "./context/SavedContext";

export default function App() {
  return <SavedProvider save={<AppNavigator />} />;
}