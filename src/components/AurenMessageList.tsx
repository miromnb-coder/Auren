import { Fragment, useEffect, useMemo, useRef } from 'react';
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

function isHorizontalRule(line: string) {
  return /^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(line);
}

function isMarkdownTableDivider(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function cleanTableLine(line: string) {
  return line
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' · ');
}

function renderInlineText(text: string, keyPrefix: string, baseStyle = styles.assistantText) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((part) => part.length > 0);

  return (
    <Text style={baseStyle}>
      {parts.map((part, index) => {
        const boldMatch = part.match(/^\*\*(.+)\*\*$/);

        if (boldMatch) {
          return (
            <Text key={`${keyPrefix}-bold-${index}`} style={styles.assistantBoldText}>
              {boldMatch[1]}
            </Text>
          );
        }

        return <Fragment key={`${keyPrefix}-text-${index}`}>{part}</Fragment>;
      })}
    </Text>
  );
}

function renderAssistantLine(rawLine: string, index: number) {
  if (isHorizontalRule(rawLine) || isMarkdownTableDivider(rawLine)) {
    return <View key={`spacer-${index}`} style={styles.assistantSmallSpacer} />;
  }

  const trimmedLine = rawLine.trim();

  if (trimmedLine.length === 0) {
    return <View key={`empty-${index}`} style={styles.assistantParagraphGap} />;
  }

  const headingMatch = trimmedLine.match(/^#{1,4}\s+(.+)$/);

  if (headingMatch) {
    const headingText = headingMatch[1].replace(/\*\*/g, '').trim();

    return (
      <Text key={`heading-${index}`} style={styles.assistantHeadingText}>
        {headingText}
      </Text>
    );
  }

  const bulletMatch = trimmedLine.match(/^[-*•]\s+(.+)$/);

  if (bulletMatch) {
    return (
      <View key={`bullet-${index}`} style={styles.assistantListRow}>
        <Text style={styles.assistantListMarker}>•</Text>
        <View style={styles.assistantListContent}>
          {renderInlineText(bulletMatch[1], `bullet-${index}`)}
        </View>
      </View>
    );
  }

  const numberedMatch = trimmedLine.match(/^(\d+)[.)]\s+(.+)$/);

  if (numberedMatch) {
    return (
      <View key={`number-${index}`} style={styles.assistantListRow}>
        <Text style={styles.assistantNumberMarker}>{numberedMatch[1]}.</Text>
        <View style={styles.assistantListContent}>
          {renderInlineText(numberedMatch[2], `number-${index}`)}
        </View>
      </View>
    );
  }

  const displayLine = trimmedLine.includes('|') ? cleanTableLine(trimmedLine) : trimmedLine;

  return (
    <View key={`paragraph-${index}`} style={styles.assistantParagraph}>
      {renderInlineText(displayLine, `paragraph-${index}`)}
    </View>
  );
}

function AurenAssistantText({ content }: { content: string }) {
  return <View style={styles.assistantTextWrap}>{content.split('\n').map(renderAssistantLine)}</View>;
}

export function AurenMessageList({ messages, assistantThinking }: AurenMessageListProps) {
  const scrollViewRef = useRef<ScrollView | null>(null);
  const messageContentSignature = useMemo(
    () => messages.map((message) => `${message.id}:${message.content.length}`).join('|'),
    [messages],
  );

  useEffect(() => {
    const scrollTimer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 40);

    return () => clearTimeout(scrollTimer);
  }, [assistantThinking, messageContentSignature]);

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

          if (message.content.length === 0) {
            return null;
          }

          return (
            <View key={message.id} style={styles.assistantRow}>
              <AurenAssistantText content={message.content} />
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
  assistantTextWrap: {
    width: '88%',
  },
  assistantText: {
    color: colors.text,
    fontSize: 17.5,
    lineHeight: 26,
    letterSpacing: -0.28,
    fontWeight: '500',
  },
  assistantBoldText: {
    fontWeight: '760',
  },
  assistantHeadingText: {
    marginTop: 10,
    marginBottom: 8,
    color: colors.text,
    fontSize: 20,
    lineHeight: 27,
    letterSpacing: -0.45,
    fontWeight: '760',
  },
  assistantParagraph: {
    marginBottom: 8,
  },
  assistantParagraphGap: {
    height: 8,
  },
  assistantSmallSpacer: {
    height: 6,
  },
  assistantListRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  assistantListMarker: {
    width: 18,
    color: colors.text,
    fontSize: 17.5,
    lineHeight: 26,
    fontWeight: '650',
  },
  assistantNumberMarker: {
    width: 28,
    color: colors.text,
    fontSize: 17.5,
    lineHeight: 26,
    fontWeight: '700',
  },
  assistantListContent: {
    flex: 1,
  },
  thinkingText: {
    color: colors.muted,
    fontSize: 15.5,
    lineHeight: 22,
    letterSpacing: -0.16,
    fontWeight: '500',
  },
});
