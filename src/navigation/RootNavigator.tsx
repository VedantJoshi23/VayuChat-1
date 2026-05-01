import React from 'react';
import { Text } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ChatScreen from '../screens/ChatScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ChatHistoryScreen from '../screens/ChatHistoryScreen';
import { Colors } from '../theme/colors';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function ChatStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen
        name="ChatMain"
        component={ChatScreen}
        options={{ title: 'Air Quality Analysis' }}
      />
    </Stack.Navigator>
  );
}

function HistoryStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen
        name="HistoryMain"
        component={ChatHistoryScreen}
        options={{ title: 'Chat History' }}
      />
    </Stack.Navigator>
  );
}

function SettingsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.lightGray,
          borderTopWidth: 1,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Chat"
        component={ChatStackNavigator}
        options={{
          tabBarLabel: 'Chat',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>💬</Text>
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryStackNavigator}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>📋</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStackNavigator}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>⚙️</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}
