// Custom entry: the font-scale cap must patch Text/TextInput before any module
// renders (or captures) them, so it runs ahead of expo-router. Keep this file
// to these two imports, in this order.
import './src/lib/fontScaleCap'
import 'expo-router/entry'
