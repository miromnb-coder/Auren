import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export type AurenMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
};

type AurenMessageListProps = {
  messages: AurenMessage[];
  assistantThinking: boolean;
};

export function AurenMessageList({ messages, assistantThinking }: AurenMessageListProps) {
  const scrollViewRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    const scrollTimer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 40);

    return () => clearTimeout(scrollTimer);
  }, [messages.length, assistantThinking]);

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {messages.map((message) => {
          if (message.role === 'user') {
            return (
              <View key={message.id} style={styles.userRow}>
                <View style={styles.userBubble}>
                  <Text style={styles.userText}>{message.content}</Text>
                </View>
              </View>
            );
          }

          return (
            <View key={message.id} style={styles.assistantRow}>
              <Text style={styles.assistantText}>{message.content}</Text>
            </View>
          );
        })}

        {assistantThinking ? (
          <View style={styles.assistantRow}>
            <Text style={styles.thinkingText}>Auren is thinking…</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },
  content: {
    flexGrow: 1,
    paddingTop: 18,
    paddingHorizontal: 22,
    paddingBottom: 178,
    justifyContent: 'flex-end',
  },
  userRow: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 22,
  },
  userBubble: {
    maxWidth: '82%',
    borderRadius: 26,
    borderBottomRightRadius: 10,
    backgroundColor: '#111217',
    paddingHorizontal: 17,
    paddingVertical: 13,
  },
  userText: {
    color: '#ffffff',
    fontSize: 16.5,
    lineHeight: 23,
    letterSpacing: -0.22,
    fontWeight: '500',
  },
  assistantRow: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  assistantText: {
    maxWidth: '88%',
    color: colors.text,
    fontSize: 17.5,
    lineHeight: 26,
    letterSpacing: -0.28,
    fontWeight: '500',
  },
  thinkingText: {
    color: colors.muted,
    fontSize: 15.5,
    lineHeight: 22,
    letterSpacing: -0.16,
    fontWeight: '500',
  },
});
