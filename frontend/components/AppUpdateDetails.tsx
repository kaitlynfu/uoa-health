import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Updates from 'expo-updates';
import { COLORS } from '../constants/theme';

export default function AppUpdateDetails() {
    const [expanded, setExpanded] = useState(false);
    const enabled = !__DEV__ && Updates.isEnabled;
    const downloaded = enabled && !Updates.isEmbeddedLaunch;
    const status = !enabled
        ? 'Update details unavailable in this build'
        : Updates.isEmergencyLaunch
            ? 'Recovery mode — running a fallback version'
            : downloaded ? 'Running a downloaded update' : 'Running the version installed with the app';
    const rows = [
        ['Channel', Updates.channel ?? 'Not available'],
        ['Runtime version', Updates.runtimeVersion ?? 'Not available'],
        ['Running update ID', enabled ? Updates.updateId ?? 'Not available' : 'Not available'],
        ['Update created', enabled && Updates.createdAt ? Updates.createdAt.toISOString() : 'Not available'],
    ];

    return (
        <View style={styles.card}>
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => setExpanded(value => !value)}
                style={styles.heading}
            >
                <Text style={styles.title}>App update details</Text>
                <Text style={styles.toggle}>{expanded ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
            {expanded && <View style={styles.details}>
                <Text style={styles.status}>{status}</Text>
                {rows.map(([label, value]) => <View key={label} style={styles.row}>
                    <Text style={styles.label}>{label}</Text>
                    <Text selectable style={styles.value}>{value}</Text>
                </View>)}
                <Text style={styles.help}>
                    {downloaded
                        ? 'Compare this running update ID with the iOS update in Expo. It is not the Git commit or update group ID.'
                        : 'An installed version does not prove a downloaded update was applied. Open the app online, allow time to download, then close and reopen it.'}
                    {' '}These details describe the version running now, not an update waiting to restart. The creation time is not the installation time.
                </Text>
            </View>}
        </View>
    );
}

const styles = StyleSheet.create({
    card: { backgroundColor: COLORS.tile, borderRadius: 16, marginBottom: 20 },
    heading: { padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    title: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.text },
    toggle: { color: COLORS.secondary, fontSize: 14 },
    details: { paddingHorizontal: 18, paddingBottom: 18, gap: 12 },
    status: { color: COLORS.text, fontWeight: '600', fontSize: 14 },
    row: { gap: 4 },
    label: { color: COLORS.text, fontWeight: '600', fontSize: 12 },
    value: { color: COLORS.text, fontSize: 13 },
    help: { color: COLORS.text, fontSize: 12, lineHeight: 18 },
});
