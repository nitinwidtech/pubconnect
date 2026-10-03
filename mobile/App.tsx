import React from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View } from "react-native";

import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { Loading } from "./src/components/UI";
import { colors } from "./src/theme";

import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import HomeScreen from "./src/screens/HomeScreen";
import WalletScreen from "./src/screens/WalletScreen";
import TransactionsScreen from "./src/screens/TransactionsScreen";
import TransactionDetailScreen from "./src/screens/TransactionDetailScreen";
import PayScreen from "./src/screens/PayScreen";
import OffersScreen from "./src/screens/OffersScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import NotificationPreferencesScreen from "./src/screens/NotificationPreferencesScreen";

const AuthStack = createNativeStackNavigator();
const AppStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.card,
    text: colors.text,
    border: colors.border,
    primary: colors.brass,
  },
};

function Tabs() {
  return (
    <Tab.Navigator
      id={undefined as any}
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.brass,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size, focused }) => {
          const map: any = {
            Home: focused ? "home" : "home-outline",
            Wallet: focused ? "wallet" : "wallet-outline",
            Pay: "qr-code",
            Offers: focused ? "pricetag" : "pricetag-outline",
            Profile: focused ? "person" : "person-outline",
          };
          if (route.name === "Pay") {
            return (
              <View
                style={{
                  backgroundColor: colors.brass,
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 4,
                }}
              >
                <Ionicons name="qr-code" size={24} color="#0D0B0A" />
              </View>
            );
          }
          return <Ionicons name={map[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="Pay" component={PayScreen} options={{ tabBarLabel: "Pay" }} />
      <Tab.Screen name="Offers" component={OffersScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const { customer, loading } = useAuth();
  if (loading) return <Loading label="Loading PubConnect…" />;

  return (
    <NavigationContainer theme={navTheme}>
      {customer ? (
        <AppStack.Navigator
          id={undefined as any}
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "700" },
          }}
        >
          <AppStack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <AppStack.Screen name="TransactionDetail" component={TransactionDetailScreen} options={{ title: "Transaction" }} />
          <AppStack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} options={{ title: "Notifications" }} />
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator id={undefined as any} screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Register" component={RegisterScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
