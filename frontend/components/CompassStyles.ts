import { StyleSheet } from 'react-native';
// Shared supporting-screen styles aligned with the team teal/pastel design.
export const compass = StyleSheet.create({
 page: { flex: 1, backgroundColor: '#ffffff' },
 content: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 20, paddingTop: 0, paddingBottom: 48, gap: 16 },
 hero: { padding: 24, borderRadius: 20, backgroundColor: '#E8F6F6', gap: 10 },
 brand: { color: '#287d7b', fontSize: 13, fontWeight: '700' },
 heroTitle: { color: '#173b39', fontSize: 28, fontWeight: '700' },
 heroCopy: { color: '#466b68', fontSize: 15, lineHeight: 23 },
 card: { padding: 20, borderWidth: 1, borderColor: '#E8EEEE', borderRadius: 16, backgroundColor: '#fff', gap: 12 },
 title: { color: '#222222', fontSize: 20, fontWeight: '700' },
 copy: { color: '#64738e', fontSize: 15, lineHeight: 24 },
 pill: { color: '#287d7b', backgroundColor: '#E8F6F6', borderRadius: 12, padding: 8, alignSelf: 'flex-start', fontSize: 12, fontWeight: '600' },
 input: { borderWidth: 1, borderColor: '#cbd7e7', borderRadius: 12, backgroundColor: '#fff', padding: 14, color: '#222222', fontSize: 16 },
 button: { backgroundColor: '#52B3B1', padding: 14, minHeight: 48, borderRadius: 12, alignItems: 'center' },
 buttonText: { color: '#173b39', fontWeight: '700', fontSize: 15 },
 link: { color: '#287d7b', fontWeight: '700', fontSize: 15, paddingVertical: 10 },
 error: { color: '#a12626', lineHeight: 22 },
});
