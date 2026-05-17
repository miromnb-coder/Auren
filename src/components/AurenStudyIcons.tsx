import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

const DEFAULT_COLOR = '#737480';
const DEFAULT_STROKE = 1.75;

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

function iconProps({ size = 18, color = DEFAULT_COLOR, strokeWidth = DEFAULT_STROKE }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

export function StudyBookIcon(props: IconProps) {
  return (
    <Svg {...iconProps(props)}>
      <Path d="M4.5 5.4c2.7 0 4.6.7 6 2.1v11c-1.4-1.2-3.3-1.8-6-1.8V5.4Z" />
      <Path d="M19.5 5.4c-2.7 0-4.6.7-6 2.1v11c1.4-1.2 3.3-1.8 6-1.8V5.4Z" />
      <Line x1="12" y1="7.6" x2="12" y2="18.7" />
    </Svg>
  );
}

export function StudyQuizIcon(props: IconProps) {
  return (
    <Svg {...iconProps(props)}>
      <Rect x="6" y="4.6" width="12" height="14.8" rx="2.2" />
      <Path d="M10 9.2h4" />
      <Path d="M10 12h3" />
      <Circle cx="14.8" cy="15.4" r=".45" fill={props.color ?? DEFAULT_COLOR} stroke="none" />
    </Svg>
  );
}

export function StudyCalendarIcon(props: IconProps) {
  return (
    <Svg {...iconProps(props)}>
      <Rect x="4.5" y="6" width="15" height="13" rx="2.2" />
      <Path d="M8.2 4.2v3" />
      <Path d="M15.8 4.2v3" />
      <Path d="M4.8 9.5h14.4" />
      <Path d="M8 13h.1" />
      <Path d="M12 13h.1" />
      <Path d="M16 13h.1" />
      <Path d="M8 16h.1" />
      <Path d="M12 16h.1" />
    </Svg>
  );
}

export function FocusTargetIcon(props: IconProps) {
  return (
    <Svg {...iconProps(props)}>
      <Circle cx="12" cy="12" r="8.2" />
      <Circle cx="12" cy="12" r="4.8" />
      <Circle cx="12" cy="12" r="1.55" fill={props.color ?? DEFAULT_COLOR} stroke="none" />
    </Svg>
  );
}

export function FocusNotebookIcon(props: IconProps) {
  return (
    <Svg {...iconProps(props)}>
      <Path d="M6.5 5.4h8.8c1.2 0 2.2 1 2.2 2.2v10.9H8.7c-1.2 0-2.2-1-2.2-2.2V5.4Z" />
      <Path d="M8.7 18.5c0-1.2 1-2.2 2.2-2.2h6.6" />
      <Path d="M6.5 8.2H4.7" />
      <Path d="M6.5 11.5H4.7" />
      <Path d="M6.5 14.8H4.7" />
      <Path d="M10.4 9.2h4.2" />
      <Path d="M10.4 12h3.2" />
    </Svg>
  );
}

export function FocusClockIcon(props: IconProps) {
  return (
    <Svg {...iconProps(props)}>
      <Circle cx="12" cy="12" r="8" />
      <Path d="M12 7.8v4.6l3.2 1.8" />
    </Svg>
  );
}

export function MoreDotsIcon(props: IconProps) {
  const color = props.color ?? DEFAULT_COLOR;
  return (
    <Svg {...iconProps(props)}>
      <Circle cx="6.5" cy="12" r="1.35" fill={color} stroke="none" />
      <Circle cx="12" cy="12" r="1.35" fill={color} stroke="none" />
      <Circle cx="17.5" cy="12" r="1.35" fill={color} stroke="none" />
    </Svg>
  );
}

export function FocusBooksCapIcon(props: IconProps) {
  return (
    <Svg {...iconProps(props)}>
      <Path d="M5.2 9.1 12 6.2l6.8 2.9L12 12 5.2 9.1Z" />
      <Path d="M8.2 10.6v3.2c1.1.8 2.4 1.2 3.8 1.2s2.7-.4 3.8-1.2v-3.2" />
      <Path d="M18.7 9.3v4.2" />
      <Path d="M7.1 16.3h8.4c1.2 0 2.1.7 2.1 1.7s-.9 1.7-2.1 1.7H7.1" />
      <Path d="M7.1 12.9h7.4c1.2 0 2.1.7 2.1 1.7s-.9 1.7-2.1 1.7H7.1" />
      <Path d="M7.1 12.9c-1 0-1.8.7-1.8 1.7s.8 1.7 1.8 1.7" />
      <Path d="M7.1 16.3c-1 0-1.8.7-1.8 1.7s.8 1.7 1.8 1.7" />
    </Svg>
  );
}

export function FocusFlameIcon(props: IconProps) {
  return (
    <Svg {...iconProps(props)}>
      <Path d="M12.6 21c3.4-.4 5.8-2.8 5.8-6.1 0-2.1-1-4-2.6-5.4-.4 1.2-1 2.1-1.9 2.8.1-2.8-1.2-5.2-4-7.3.1 3-1.2 4.5-2.5 6.1-1 1.2-1.8 2.4-1.8 4.1 0 3 2.2 5.4 5.4 5.8" />
      <Path d="M12.1 18.3c1.2-.2 2-1.1 2-2.2 0-.9-.4-1.7-1.2-2.3-.2.7-.6 1.2-1.2 1.6 0-1-.4-1.9-1.3-2.7.1 1.3-.6 2-1.1 2.7-.4.5-.6.9-.6 1.5 0 1.1.8 2.1 2.1 2.3" />
    </Svg>
  );
}

export function FocusChecklistIcon(props: IconProps) {
  return (
    <Svg {...iconProps(props)}>
      <Path d="M6.2 7.2 7.4 8.4l2-2.3" />
      <Path d="M12 7.5h6" />
      <Path d="M6.2 12 7.4 13.2l2-2.3" />
      <Path d="M12 12.3h6" />
      <Path d="M6.2 16.8 7.4 18l2-2.3" />
      <Path d="M12 17.1h6" />
    </Svg>
  );
}

export function FocusSparkleIcon(props: IconProps) {
  return (
    <Svg {...iconProps(props)}>
      <Path d="M12 3.8c.7 3.3 2.5 5.1 5.8 5.8-3.3.7-5.1 2.5-5.8 5.8-.7-3.3-2.5-5.1-5.8-5.8 3.3-.7 5.1-2.5 5.8-5.8Z" />
      <Path d="M18.5 14.1c.3 1.4 1.1 2.2 2.5 2.5-1.4.3-2.2 1.1-2.5 2.5-.3-1.4-1.1-2.2-2.5-2.5 1.4-.3 2.2-1.1 2.5-2.5Z" />
    </Svg>
  );
}

export function FocusProgressRing({ size = 58, color = DEFAULT_COLOR, progress = 0 }: IconProps & { progress?: number }) {
  const safeProgress = Math.min(Math.max(progress, 0), 1);
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - safeProgress);

  return (
    <Svg width={size} height={size} viewBox="0 0 58 58" fill="none">
      <Circle cx="29" cy="29" r={radius} stroke="rgba(220,221,226,0.95)" strokeWidth="6" />
      <Circle
        cx="29"
        cy="29"
        r={radius}
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 29 29)"
      />
    </Svg>
  );
}
