// import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
// import { Ionicons } from "@expo/vector-icons";

// type Props = {
//     navigation: any;
//     onClose: () => void;
// };

// export default function SideBar({ navigation, onClose }: Props) {
//     const goTo = (screen: string) => {onClose(); navigation.navigation(screen);};
    
//     const Item = ({ icon, label, screen }: any) => (
//         <TouchableOpacity style={styles.item} onPress={() => goTo(screen)}>
//             <Ionicons name={icon} size={21} color="#173A63"/>
//             <Text style={styles.itemText}>{label}</Text>
//         </TouchableOpacity>
//     );

//     return (
//         <View style={styles.overlay}>
//             <TouchableOpacity style={styles.backdrop} onPress={onClose}/>
//             <View style={styles.sidebar}>
//                 <View style={styles.top}>
//                     <View>
//                         <Text style={styles.top}
//                     </View>
//                 </View>
//             </View>
//         </View>
//     );
// }

// const styles = StyleSheet.create({

// });